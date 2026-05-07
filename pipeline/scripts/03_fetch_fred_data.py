"""
Ohio Real Estate Market Intelligence Platform
Script 03: FRED Economic Data Fetcher (CSV method - no API key required)
Fetches Ohio housing price indices, mortgage rates, and economic indicators
from the Federal Reserve Bank of St. Louis FRED via direct CSV download
"""

import requests
import pandas as pd
import time
import io
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
RAW_DIR = BASE_DIR / "data" / "raw"
RAW_DIR.mkdir(parents=True, exist_ok=True)

FRED_CSV_BASE = "https://fred.stlouisfed.org/graph/fredgraph.csv"

# FRED series: id -> friendly_name, category
FRED_SERIES = [
    # Ohio housing price indices
    ("OHSTHPI",        "ohio_hpi_all_transactions",      "housing_index"),
    # Ohio Realtor.com / HUD listing data
    ("MEDLISPRIOH",    "ohio_median_listing_price",       "housing_price"),
    ("ACTLISCOUOH",    "ohio_active_listing_count",       "inventory"),
    ("NEWLISCOUOH",    "ohio_new_listing_count",          "inventory"),
    ("DAYSOH",         "ohio_median_days_on_market",      "market_speed"),
    # Metro HPI (FHFA All-Transactions)
    ("ATNHPIUS18140Q", "cleveland_hpi_fhfa",             "metro_hpi"),
    ("ATNHPIUS17460Q", "columbus_hpi_fhfa",              "metro_hpi"),
    ("ATNHPIUS19380Q", "dayton_hpi_fhfa",                "metro_hpi"),
    ("ATNHPIUS17140Q", "cincinnati_hpi_fhfa",            "metro_hpi"),
    ("ATNHPIUS10420Q", "akron_hpi_fhfa",                 "metro_hpi"),
    ("ATNHPIUS45780Q", "toledo_hpi_fhfa",                "metro_hpi"),
    ("ATNHPIUS49660Q", "youngstown_hpi_fhfa",            "metro_hpi"),
    # Mortgage rates
    ("MORTGAGE30US",   "mortgage_rate_30yr_fixed",        "mortgage"),
    ("MORTGAGE15US",   "mortgage_rate_15yr_fixed",        "mortgage"),
    ("FEDFUNDS",       "federal_funds_rate",              "monetary_policy"),
    # Ohio economy
    ("OHUR",           "ohio_unemployment_rate",          "economy"),
    ("OHNA",           "ohio_nonfarm_employment",         "economy"),
    # National housing
    ("HOUST",          "housing_starts_national",         "supply"),
    ("PERMIT",         "building_permits_national",       "supply"),
    ("CSUSHPINSA",     "case_shiller_national_hpi",       "housing_index"),
    # Consumer confidence
    ("UMCSENT",        "consumer_sentiment_umich",        "sentiment"),
    # Inflation
    ("CPIAUCSL",       "cpi_all_urban",                   "inflation"),
]


def fetch_fred_csv(series_id: str, start_year: int = 2015) -> pd.DataFrame:
    """Fetch FRED data via direct CSV download."""
    url = f"{FRED_CSV_BASE}?id={series_id}"
    try:
        resp = requests.get(url, timeout=30)
        resp.raise_for_status()
        df = pd.read_csv(io.StringIO(resp.text))
        df.columns = ["date", "value"]
        df["date"] = pd.to_datetime(df["date"])
        df["value"] = pd.to_numeric(df["value"], errors="coerce")
        df = df.dropna(subset=["value"])
        df = df[df["date"].dt.year >= start_year]
        df["series_id"] = series_id
        return df
    except Exception as e:
        print(f"    ERROR {series_id}: {e}")
        return pd.DataFrame()


def main():
    print("=" * 60)
    print("Ohio Real Estate - FRED Economic Data Fetcher")
    print("=" * 60)

    all_dfs = []
    meta_rows = []
    ok = 0
    fail = 0

    for series_id, friendly_name, category in FRED_SERIES:
        print(f"  [{category}] {series_id} -> {friendly_name}")
        df = fetch_fred_csv(series_id)
        if not df.empty:
            df["friendly_name"] = friendly_name
            df["category"] = category
            all_dfs.append(df)
            print(f"    {len(df)} observations | {df['date'].min().date()} to {df['date'].max().date()}")
            meta_rows.append({
                "series_id": series_id,
                "friendly_name": friendly_name,
                "category": category,
                "n_obs": len(df),
                "start_date": str(df["date"].min().date()),
                "end_date": str(df["date"].max().date()),
            })
            ok += 1
        else:
            fail += 1
        time.sleep(0.2)

    print(f"\nSuccessful: {ok} | Failed: {fail}")

    if all_dfs:
        long_df = pd.concat(all_dfs, ignore_index=True)
        long_df.to_parquet(RAW_DIR / "fred_ohio_long.parquet", index=False)
        long_df.to_csv(RAW_DIR / "fred_ohio_long.csv", index=False)
        print(f"Saved long format: {len(long_df):,} rows")

        # Wide format (monthly resampled)
        wide = long_df.pivot_table(
            index="date", columns="friendly_name", values="value", aggfunc="last"
        ).reset_index()
        wide.to_parquet(RAW_DIR / "fred_ohio_wide.parquet", index=False)
        wide.to_csv(RAW_DIR / "fred_ohio_wide.csv", index=False)
        print(f"Saved wide format: {len(wide):,} rows x {len(wide.columns)} cols")

    if meta_rows:
        pd.DataFrame(meta_rows).to_csv(RAW_DIR / "fred_series_metadata.csv", index=False)

    print("\nFRED data fetch complete!")


if __name__ == "__main__":
    main()
