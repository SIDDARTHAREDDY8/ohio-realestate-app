"""
Ohio Real Estate Market Intelligence Platform
Script 02: Redfin Market Tracker Data Fetcher (Optimized - streams & filters)
Downloads Redfin's public housing market data and filters for Ohio
"""

import requests
import pandas as pd
import gzip
import io
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
    """Stream-download a gzipped TSV from Redfin S3 and filter for Ohio."""
    print(f"\nDownloading {name} data...")
    try:
        resp = requests.get(url, stream=True, timeout=300)
        resp.raise_for_status()
        size_mb = int(resp.headers.get("Content-Length", 0)) / 1e6
        print(f"  Size: {size_mb:.0f} MB - downloading...")

        # Read in chunks to avoid memory issues
        chunks = []
        for chunk in resp.iter_content(chunk_size=10*1024*1024):  # 10MB chunks
            chunks.append(chunk)
        print(f"  Downloaded. Decompressing...")

        compressed = io.BytesIO(b"".join(chunks))
        with gzip.open(compressed, "rt", encoding="utf-8", errors="replace") as f:
            df = pd.read_csv(f, sep="\t", low_memory=False)

        print(f"  Total rows: {len(df):,}")

        # Filter for Ohio
        if "state_code" in df.columns:
            ohio_df = df[df["state_code"] == "OH"].copy()
        elif "state" in df.columns:
            ohio_df = df[df["state"].str.upper().isin(["OH", "OHIO"])].copy()
        else:
            ohio_df = df.copy()

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
