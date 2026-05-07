#!/usr/bin/env python3
"""
Ohio Real Estate Market Intelligence Platform
Main Pipeline Runner — executed by GitHub Actions on schedule

Steps:
  1. Fetch Census ACS data (88 Ohio counties, 2019–current)
  2. Fetch Redfin market tracker data (county level)
  3. Fetch FRED economic indicators (21 series)
  4. Run ETL pipeline → DuckDB warehouse
  5. Feature engineering
  6. Train ML models
  7. Export JSON data for React frontend
  8. Write pipeline metadata (run timestamp, record counts)

Usage:
  python pipeline/run_pipeline.py [--skip-models] [--skip-redfin]
"""

import sys
import os
import json
import time
import logging
import argparse
import subprocess
from pathlib import Path
from datetime import datetime, timezone

# ── Paths ──────────────────────────────────────────────────────────────────
REPO_ROOT   = Path(__file__).resolve().parent.parent
PIPELINE    = Path(__file__).resolve().parent
SCRIPTS_DIR = PIPELINE / "scripts"
ETL_DIR     = PIPELINE / "src" / "etl"
MODELS_DIR  = PIPELINE / "src" / "models"
DATA_DIR    = REPO_ROOT / "pipeline" / "data"
RAW_DIR     = DATA_DIR / "raw"
PROCESSED   = DATA_DIR / "processed"
WAREHOUSE   = DATA_DIR / "warehouse"
FRONTEND_DATA = REPO_ROOT / "client" / "src" / "data"

for d in [RAW_DIR, PROCESSED, WAREHOUSE, FRONTEND_DATA]:
    d.mkdir(parents=True, exist_ok=True)

# Local development fallback: if pipeline/data is empty, use the original ohio-realestate data
_ORIG_DATA = REPO_ROOT.parent / "ohio-realestate" / "data"
if not any(PROCESSED.glob("*.parquet")) and (_ORIG_DATA / "processed").exists():
    import shutil
    for f in (_ORIG_DATA / "processed").glob("*.parquet"):
        dest = PROCESSED / f.name
        if not dest.exists():
            shutil.copy2(f, dest)
    for f in (_ORIG_DATA / "raw").glob("*.parquet"):
        dest = RAW_DIR / f.name
        if not dest.exists():
            shutil.copy2(f, dest)
    # Copy DuckDB warehouse
    orig_db = _ORIG_DATA / "warehouse" / "ohio_realestate.duckdb"
    dest_db = WAREHOUSE / "ohio_realestate.duckdb"
    if orig_db.exists() and not dest_db.exists():
        shutil.copy2(orig_db, dest_db)

# ── Logging ────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(PIPELINE / "pipeline.log", mode="a"),
    ],
)
logger = logging.getLogger("pipeline")


def run_step(name: str, script: Path, env: dict | None = None) -> bool:
    """Run a Python script as a subprocess, streaming output."""
    logger.info(f"▶ {name}")
    start = time.time()
    merged_env = {**os.environ, **(env or {})}
    result = subprocess.run(
        [sys.executable, str(script)],
        env=merged_env,
        capture_output=False,
    )
    elapsed = time.time() - start
    if result.returncode == 0:
        logger.info(f"✓ {name} completed in {elapsed:.1f}s")
        return True
    else:
        logger.error(f"✗ {name} FAILED (exit {result.returncode}) after {elapsed:.1f}s")
        return False


def patch_paths(script_path: Path):
    """
    Rewrite BASE_DIR in pipeline scripts to point to pipeline/data/
    so they work from any working directory in the repo.
    """
    content = script_path.read_text()
    # Replace the standard BASE_DIR resolution with an absolute path
    old = "BASE_DIR = Path(__file__).resolve().parent.parent"
    new = f"BASE_DIR = Path(r'{PIPELINE}')"
    if old in content:
        patched = content.replace(old, new)
        script_path.write_text(patched)
        logger.info(f"  Patched BASE_DIR in {script_path.name}")


def export_frontend_data():
    """Export processed data to JSON for the React frontend."""
    import pandas as pd
    import numpy as np
    import duckdb
    import re

    logger.info("▶ Exporting data to frontend JSON files")

    def to_json_safe(obj):
        if isinstance(obj, (np.integer,)):
            return int(obj)
        if isinstance(obj, (np.floating,)):
            return None if np.isnan(obj) else float(obj)
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        if isinstance(obj, pd.Timestamp):
            return str(obj.date())
        return obj

    def df_to_json(df: pd.DataFrame, path: Path):
        records = []
        for _, row in df.iterrows():
            rec = {k: to_json_safe(v) for k, v in row.items()}
            records.append(rec)
        raw = json.dumps(records, default=str)
        # Replace any remaining NaN / Infinity that slipped through
        clean = re.sub(r'\bNaN\b', 'null', raw)
        clean = re.sub(r'\bInfinity\b', 'null', clean)
        clean = re.sub(r'\b-Infinity\b', 'null', clean)
        path.write_text(clean)
        logger.info(f"  {path.name}: {len(records)} records")

    exports = {
        "county_summary.json":          PROCESSED / "mart_county_summary.parquet",
        "county_features_2023.json":    None,   # built inline
        "market_heat_index.json":       PROCESSED / "market_heat_index.parquet",
        "market_clusters.json":         PROCESSED / "market_clusters.parquet",
        "affordability_predictions.json": PROCESSED / "affordability_predictions.parquet",
        "county_value_predictions.json":  PROCESSED / "county_value_predictions.parquet",
        "hpi_forecast.json":            PROCESSED / "hpi_forecast.parquet",
    }

    for filename, src in exports.items():
        if src and src.exists():
            df = pd.read_parquet(src)
            if "date" in df.columns:
                df["date"] = pd.to_datetime(df["date"]).dt.strftime("%Y-%m-%d")
            df_to_json(df, FRONTEND_DATA / filename)

    # County features 2023
    feat_path = PROCESSED / "county_features.parquet"
    if feat_path.exists():
        df = pd.read_parquet(feat_path)
        df23 = df[df["year"] == 2023].copy()
        df_to_json(df23, FRONTEND_DATA / "county_features_2023.json")

    # Economic indicators
    econ_path = PROCESSED / "fact_economic_indicators.parquet"
    if econ_path.exists():
        df = pd.read_parquet(econ_path)
        df["date"] = pd.to_datetime(df["date"]).dt.strftime("%Y-%m-%d")
        df_to_json(df, FRONTEND_DATA / "economic_indicators.json")

    # Redfin county market (last 3 years, All Residential)
    redfin_path = RAW_DIR / "redfin_county_ohio.parquet"
    if redfin_path.exists():
        df = pd.read_parquet(redfin_path)
        df = df[df.get("property_type", pd.Series(dtype=str)) == "All Residential"].copy()
        df["period_begin"] = pd.to_datetime(df["period_begin"])
        df = df[df["period_begin"] >= "2020-01-01"]
        keep = ["period_begin", "region", "median_sale_price", "median_list_price",
                "median_ppsf", "homes_sold", "inventory", "months_of_supply",
                "median_dom", "avg_sale_to_list", "sold_above_list", "price_drops",
                "median_sale_price_yoy", "homes_sold_yoy", "inventory_yoy"]
        df = df[[c for c in keep if c in df.columns]].copy()
        df["period_begin"] = df["period_begin"].dt.strftime("%Y-%m-%d")
        df_to_json(df, FRONTEND_DATA / "redfin_county_market.json")

    # KPIs
    db_path = WAREHOUSE / "ohio_realestate.duckdb"
    if db_path.exists():
        conn = duckdb.connect(str(db_path), read_only=True)
        kpis: dict = {}
        try:
            r = conn.execute("""
                SELECT
                    AVG(median_home_value_2023),
                    AVG(median_rent_2023),
                    AVG(homeownership_rate_2023),
                    AVG(vacancy_rate_2023),
                    SUM(total_population_2023),
                    AVG(home_value_5yr_change),
                    COUNT(*)
                FROM ohio_re.mart_county_summary
            """).fetchone()
            kpis["statewide"] = {
                "avg_home_value":           round(r[0], 0) if r[0] else None,
                "avg_rent":                 round(r[1], 0) if r[1] else None,
                "avg_homeownership_rate":   round(r[2], 1) if r[2] else None,
                "avg_vacancy_rate":         round(r[3], 1) if r[3] else None,
                "total_population":         int(r[4]) if r[4] else None,
                "avg_5yr_appreciation_pct": round(r[5], 1) if r[5] else None,
                "county_count":             int(r[6]) if r[6] else None,
            }
            for series, name in [
                ("ohio_median_listing_price", "latest_listing_price"),
                ("mortgage_rate_30yr_fixed",  "mortgage_rate_30yr"),
                ("ohio_unemployment_rate",    "unemployment_rate"),
                ("ohio_hpi_all_transactions", "hpi"),
            ]:
                row = conn.execute(f"""
                    SELECT value FROM ohio_re.fact_economic_indicators
                    WHERE friendly_name = '{series}'
                    ORDER BY date DESC LIMIT 1
                """).fetchone()
                kpis[name] = round(float(row[0]), 2) if row else None
        finally:
            conn.close()

        (FRONTEND_DATA / "kpis.json").write_text(json.dumps(kpis, indent=2))
        logger.info("  kpis.json: updated")

    # Write pipeline metadata visible in the UI
    meta = {
        "last_refresh":      datetime.now(timezone.utc).isoformat(),
        "data_sources":      ["US Census Bureau ACS", "Redfin Market Tracker", "FRED"],
        "counties_covered":  88,
    }
    (FRONTEND_DATA / "pipeline_meta.json").write_text(json.dumps(meta, indent=2))
    logger.info("  pipeline_meta.json: updated")
    logger.info("✓ Frontend export complete")


def main():
    parser = argparse.ArgumentParser(description="Ohio RE Pipeline Runner")
    parser.add_argument("--skip-models",  action="store_true", help="Skip ML model training")
    parser.add_argument("--skip-redfin",  action="store_true", help="Skip Redfin download (large file)")
    parser.add_argument("--export-only",  action="store_true", help="Only run the JSON export step")
    args = parser.parse_args()

    start = datetime.now()
    logger.info("=" * 60)
    logger.info("Ohio Real Estate ETL + ML Pipeline")
    logger.info(f"Started: {start.isoformat()}")
    logger.info("=" * 60)

    if args.export_only:
        export_frontend_data()
        return

    # Patch BASE_DIR in all scripts so they write to pipeline/data/
    for script in [
        SCRIPTS_DIR / "01_fetch_census_data.py",
        SCRIPTS_DIR / "02_fetch_redfin_data.py",
        SCRIPTS_DIR / "03_fetch_fred_data.py",
        ETL_DIR / "pipeline.py",
        ETL_DIR / "feature_engineering.py",
        MODELS_DIR / "train_models.py",
    ]:
        if script.exists():
            patch_paths(script)

    steps = []

    # 1. Data acquisition
    steps.append(("Census ACS Data",     SCRIPTS_DIR / "01_fetch_census_data.py"))
    if not args.skip_redfin:
        steps.append(("Redfin Market Data",  SCRIPTS_DIR / "02_fetch_redfin_data.py"))
    steps.append(("FRED Economic Data",  SCRIPTS_DIR / "03_fetch_fred_data.py"))

    # 2. ETL
    steps.append(("ETL Pipeline",        ETL_DIR / "pipeline.py"))
    steps.append(("Feature Engineering", ETL_DIR / "feature_engineering.py"))

    # 3. ML models
    if not args.skip_models:
        steps.append(("ML Model Training", MODELS_DIR / "train_models.py"))

    failed = []
    for name, script in steps:
        if not script.exists():
            logger.warning(f"  Script not found: {script}")
            continue
        ok = run_step(name, script)
        if not ok:
            failed.append(name)

    # 4. Export to frontend
    export_frontend_data()

    # Summary
    elapsed = (datetime.now() - start).total_seconds()
    logger.info("=" * 60)
    if failed:
        logger.error(f"Pipeline finished with {len(failed)} failure(s): {failed}")
        logger.info(f"Total time: {elapsed:.0f}s")
        sys.exit(1)
    else:
        logger.info(f"Pipeline complete — all steps succeeded in {elapsed:.0f}s")
        logger.info("=" * 60)


if __name__ == "__main__":
    main()
