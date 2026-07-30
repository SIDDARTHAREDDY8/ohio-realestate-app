"""
Ohio Real Estate Market Intelligence Platform
Script 02: Redfin Market Tracker Data Fetcher (Optimized - streams & filters)
Downloads Redfin's public housing market data and filters for Ohio
"""

import requests
import pandas as pd
import gzip
import tempfile
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
RAW_DIR = BASE_DIR / "data" / "raw"
RAW_DIR.mkdir(parents=True, exist_ok=True)

REDFIN_S3 = "https://redfin-public-data.s3.us-west-2.amazonaws.com/redfin_market_tracker"

DATASETS = {
    "county": f"{REDFIN_S3}/county_market_tracker.tsv000.gz",
    "city":   f"{REDFIN_S3}/city_market_tracker.tsv000.gz",
    "state":  f"{REDFIN_S3}/state_market_tracker.tsv000.gz",
}


def download_and_filter_ohio(name: str, url: str) -> pd.DataFrame:
    """Stream-download a gzipped TSV from Redfin S3 to disk and filter for Ohio."""
    print(f"\nDownloading {name} data...")
    tmp_path = None
    try:
        resp = requests.get(url, stream=True, timeout=300)
        resp.raise_for_status()
        size_mb = int(resp.headers.get("Content-Length", 0)) / 1e6
        print(f"  Size: {size_mb:.0f} MB - downloading...")

        # Stream to a temp file so the full (multi-GB) download never sits in memory
        with tempfile.NamedTemporaryFile(suffix=".tsv.gz", delete=False) as tmp:
            tmp_path = tmp.name
            for chunk in resp.iter_content(chunk_size=10 * 1024 * 1024):
                tmp.write(chunk)
        print("  Downloaded. Filtering for Ohio in chunks...")

        # Read in chunks, keeping only Ohio rows
        ohio_parts = []
        total_rows = 0
        with gzip.open(tmp_path, "rt", encoding="utf-8", errors="replace") as f:
            for chunk_df in pd.read_csv(f, sep="\t", low_memory=False, chunksize=250_000):
                # Redfin switched the export to UPPERCASE column names in 2026;
                # normalize so both old and new formats work downstream.
                chunk_df.columns = [c.lower() for c in chunk_df.columns]
                total_rows += len(chunk_df)
                if "state_code" in chunk_df.columns:
                    part = chunk_df[chunk_df["state_code"] == "OH"]
                elif "state" in chunk_df.columns:
                    part = chunk_df[chunk_df["state"].str.upper().isin(["OH", "OHIO"])]
                else:
                    part = chunk_df
                if not part.empty:
                    ohio_parts.append(part)

        ohio_df = pd.concat(ohio_parts, ignore_index=True) if ohio_parts else pd.DataFrame()
        print(f"  Total rows: {total_rows:,}")
        print(f"  Ohio rows: {len(ohio_df):,}")

        # Parse dates
        for date_col in ["period_begin", "period_end", "last_updated"]:
            if date_col in ohio_df.columns:
                ohio_df[date_col] = pd.to_datetime(ohio_df[date_col], errors="coerce")

        return ohio_df

    except Exception as e:
        print(f"  ERROR: {e}")
        import traceback
        traceback.print_exc()
        return pd.DataFrame()
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)


def main():
    print("=" * 60)
    print("Ohio Real Estate - Redfin Market Tracker Fetcher")
    print("=" * 60)

    for name, url in DATASETS.items():
        df = download_and_filter_ohio(name, url)
        if not df.empty:
            parquet_path = RAW_DIR / f"redfin_{name}_ohio.parquet"
            csv_path = RAW_DIR / f"redfin_{name}_ohio.csv"
            df.to_parquet(parquet_path, index=False)
            df.to_csv(csv_path, index=False)
            print(f"  Saved: {parquet_path.name} ({len(df):,} rows x {len(df.columns)} cols)")
            if "period_begin" in df.columns:
                print(f"  Date range: {df['period_begin'].min()} to {df['period_begin'].max()}")
            if "property_type" in df.columns:
                print(f"  Property types: {df['property_type'].unique().tolist()}")

    print("\nRedfin data fetch complete!")


if __name__ == "__main__":
    main()
