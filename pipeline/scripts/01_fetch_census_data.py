"""
Ohio Real Estate Market Intelligence Platform
Script 01: Census Bureau ACS Data Fetcher
Fetches housing metrics for all 88 Ohio counties from US Census Bureau ACS 5-Year API
Data: Median home value, median gross rent, tenure (owner/renter), housing units, vacancy
"""

import sys
import time
from pathlib import Path

import pandas as pd
import requests

BASE_DIR = Path(__file__).resolve().parent.parent
RAW_DIR = BASE_DIR / "data" / "raw"
RAW_DIR.mkdir(parents=True, exist_ok=True)

CENSUS_BASE = "https://api.census.gov/data"
OHIO_FIPS = "39"

# ACS variable definitions
ACS_VARIABLES = {
    # Housing value
    "B25077_001E": "median_home_value",
    # Gross rent
    "B25064_001E": "median_gross_rent",
    # Tenure
    "B25003_001E": "total_housing_units_tenure",
    "B25003_002E": "owner_occupied",
    "B25003_003E": "renter_occupied",
    # Total housing units
    "B25001_001E": "total_housing_units",
    # Vacancy
    "B25002_001E": "total_units_vacancy",
    "B25002_002E": "occupied_units",
    "B25002_003E": "vacant_units",
    # Median household income
    "B19013_001E": "median_household_income",
    # Population
    "B01003_001E": "total_population",
    # Housing age - median year built
    "B25035_001E": "median_year_structure_built",
    # Median rooms
    "B25018_001E": "median_rooms",
    # Median value by mortgage status
    "B25085_001E": "median_value_with_mortgage",
    # Monthly owner costs
    "B25088_001E": "median_monthly_owner_costs_mortgage",
    "B25088_002E": "median_monthly_owner_costs_no_mortgage",
}

YEARS = [2019, 2020, 2021, 2022, 2023]


def fetch_acs_county_data(year: int, variables: dict) -> pd.DataFrame:
    """Fetch ACS 5-year data for all Ohio counties for a given year."""
    var_list = ",".join(["NAME"] + list(variables.keys()))
    url = f"{CENSUS_BASE}/{year}/acs/acs5"
    params = {
        "get": var_list,
        "for": "county:*",
        "in": f"state:{OHIO_FIPS}",
    }

    print(f"  Fetching ACS {year} county data...")
    try:
        resp = requests.get(url, params=params, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        headers = data[0]
        rows = data[1:]
        df = pd.DataFrame(rows, columns=headers)

        # Rename columns
        rename_map = {k: v for k, v in variables.items() if k in df.columns}
        df = df.rename(columns=rename_map)

        # Add year
        df["year"] = year

        # Clean county name
        df["county_name"] = df["NAME"].str.replace(", Ohio", "").str.strip()
        df["county_fips"] = df["state"] + df["county"]

        # Convert numeric columns
        numeric_cols = list(variables.values())
        for col in numeric_cols:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce")
                # Replace -666666666 (Census null sentinel) with NaN
                df[col] = df[col].replace(-666666666, pd.NA)

        return df

    except Exception as e:
        print(f"  ERROR fetching ACS {year}: {e}")
        return pd.DataFrame()


def fetch_acs_zip_data(year: int) -> pd.DataFrame:
    """Fetch ACS 5-year data for Ohio zip code tabulation areas."""
    zip_vars = {
        "B25077_001E": "median_home_value",
        "B25064_001E": "median_gross_rent",
        "B25003_001E": "total_housing_units_tenure",
        "B25003_002E": "owner_occupied",
        "B25003_003E": "renter_occupied",
        "B19013_001E": "median_household_income",
        "B01003_001E": "total_population",
    }
    var_list = ",".join(["NAME"] + list(zip_vars.keys()))
    url = f"{CENSUS_BASE}/{year}/acs/acs5"
    params = {
        "get": var_list,
        "for": "zip code tabulation area:*",
        "in": f"state:{OHIO_FIPS}",
    }

    print(f"  Fetching ACS {year} ZIP code data...")
    try:
        resp = requests.get(url, params=params, timeout=60)
        resp.raise_for_status()
        data = resp.json()
        headers = data[0]
        rows = data[1:]
        df = pd.DataFrame(rows, columns=headers)
        df = df.rename(columns={k: v for k, v in zip_vars.items() if k in df.columns})
        df["year"] = year
        df["zip_code"] = df["zip code tabulation area"]

        numeric_cols = list(zip_vars.values())
        for col in numeric_cols:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce")
                df[col] = df[col].replace(-666666666, pd.NA)

        return df
    except Exception as e:
        print(f"  ERROR fetching ACS {year} ZIP: {e}")
        return pd.DataFrame()


def main():
    print("=" * 60)
    print("Ohio Real Estate - Census ACS Data Fetcher")
    print("=" * 60)

    # Fetch county-level data for all years
    county_frames = []
    for year in YEARS:
        df = fetch_acs_county_data(year, ACS_VARIABLES)
        if not df.empty:
            county_frames.append(df)
            print(f"  Got {len(df)} counties for {year}")
        time.sleep(0.5)  # Rate limiting

    out_path = RAW_DIR / "census_acs_county_ohio.parquet"
    if county_frames:
        county_df = pd.concat(county_frames, ignore_index=True)
        county_df.to_parquet(out_path, index=False)
        print(f"\nSaved county data: {out_path}")
        print(f"Shape: {county_df.shape}")
        print(f"Counties: {county_df['county_name'].nunique()}")
        print(f"Years: {sorted(county_df['year'].unique())}")

        # Also save as CSV for inspection
        county_df.to_csv(RAW_DIR / "census_acs_county_ohio.csv", index=False)
    elif out_path.exists():
        # Downstream steps can proceed on the previous snapshot; a silent
        # empty fetch here is what used to crash model training later.
        print("\nWARNING: Census fetch returned no data — keeping existing snapshot "
              f"({out_path.name}). Data will be stale until the API recovers.")
    else:
        sys.exit("ERROR: Census fetch returned no data and no existing snapshot exists. "
                 "Cannot continue — the warehouse would be empty.")

    # Fetch ZIP code data for latest year only (large dataset)
    print("\nFetching ZIP code data (2023)...")
    zip_df = fetch_acs_zip_data(2023)
    if not zip_df.empty:
        zip_df.to_parquet(RAW_DIR / "census_acs_zip_ohio.parquet", index=False)
        zip_df.to_csv(RAW_DIR / "census_acs_zip_ohio.csv", index=False)
        print(f"Saved ZIP data: {len(zip_df)} ZIP codes")

    print("\nCensus data fetch complete!")


if __name__ == "__main__":
    main()
