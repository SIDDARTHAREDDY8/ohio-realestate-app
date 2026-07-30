"""
Ohio Real Estate Market Intelligence Platform
Feature Engineering: Creates ML-ready feature sets from warehouse data
Produces: county-level features, time-series features, affordability metrics
"""

import duckdb
import pandas as pd
from pathlib import Path
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent.parent
WAREHOUSE_DIR = BASE_DIR / "data" / "warehouse"
PROCESSED_DIR = BASE_DIR / "data" / "processed"
DB_PATH = WAREHOUSE_DIR / "ohio_realestate.duckdb"


def build_county_features(conn: duckdb.DuckDBPyConnection) -> pd.DataFrame:
    """Build comprehensive county-level feature matrix for ML."""
    logger.info("Building county feature matrix...")

    query = """
    SELECT
        h.county_fips,
        c.county_name,
        c.metro_area,
        c.region,
        c.is_metro,
        h.year,
        -- Housing values
        h.median_home_value,
        h.median_gross_rent,
        h.median_household_income,
        -- Housing stock
        h.total_housing_units,
        h.owner_occupied,
        h.renter_occupied,
        h.vacant_units,
        h.total_population,
        -- Derived rates
        h.homeownership_rate,
        h.vacancy_rate,
        h.renter_rate,
        h.affordability_ratio,
        -- YoY changes
        h.home_value_yoy,
        h.rent_yoy,
        h.income_yoy,
        -- Housing characteristics
        h.median_year_structure_built,
        h.median_rooms,
        -- Computed features
        h.median_home_value / NULLIF(h.median_household_income, 0) AS price_to_income_ratio,
        h.median_gross_rent * 12 / NULLIF(h.median_home_value, 0) * 100 AS gross_rent_yield,
        h.total_population / NULLIF(h.total_housing_units, 0) AS persons_per_unit,
        (h.year - h.median_year_structure_built) AS housing_stock_age,
        h.owner_occupied / NULLIF(h.total_housing_units, 0) * 100 AS owner_rate_pct
    FROM ohio_re.fact_census_housing h
    JOIN ohio_re.dim_county c ON h.county_fips = c.county_fips
    ORDER BY h.county_fips, h.year
    """

    df = conn.execute(query).df()

    # Lag features (previous year values)
    df = df.sort_values(["county_fips", "year"])
    for col in ["median_home_value", "median_gross_rent", "median_household_income",
                "homeownership_rate", "vacancy_rate"]:
        df[f"{col}_lag1"] = df.groupby("county_fips")[col].shift(1)
        df[f"{col}_lag2"] = df.groupby("county_fips")[col].shift(2)

    # Rolling averages
    for col in ["median_home_value", "median_household_income"]:
        df[f"{col}_roll3"] = df.groupby("county_fips")[col].transform(
            lambda x: x.rolling(3, min_periods=1).mean()
        )

    # Encode region
    region_dummies = pd.get_dummies(df["region"], prefix="region")
    df = pd.concat([df, region_dummies], axis=1)

    # Metro binary
    df["is_metro_int"] = df["is_metro"].astype(int)

    logger.info(f"  County features: {df.shape}")
    return df


def build_time_series_features(conn: duckdb.DuckDBPyConnection) -> pd.DataFrame:
    """Build time-series features from FRED economic indicators."""
    logger.info("Building time-series features...")

    query = """
    SELECT date, friendly_name, value
    FROM ohio_re.fact_economic_indicators
    ORDER BY friendly_name, date
    """
    df_long = conn.execute(query).df()

    # Pivot to wide format
    df_wide = df_long.pivot_table(
        index="date", columns="friendly_name", values="value", aggfunc="last"
    ).reset_index()

    # Resample to monthly
    df_wide["date"] = pd.to_datetime(df_wide["date"])
    df_wide = df_wide.set_index("date").resample("MS").last().reset_index()

    # Compute derived features
    if "mortgage_rate_30yr_fixed" in df_wide.columns and "ohio_median_listing_price" in df_wide.columns:
        # Monthly payment affordability index
        r = df_wide["mortgage_rate_30yr_fixed"] / 100 / 12
        n = 360  # 30 years
        price = df_wide["ohio_median_listing_price"] * 0.8  # 20% down
        df_wide["monthly_mortgage_payment"] = (price * r * (1 + r)**n) / ((1 + r)**n - 1)

    # YoY and MoM changes for key series
    for col in ["ohio_hpi_all_transactions", "ohio_median_listing_price",
                "mortgage_rate_30yr_fixed", "ohio_unemployment_rate",
                "consumer_sentiment_umich"]:
        if col in df_wide.columns:
            df_wide[f"{col}_mom"] = df_wide[col].pct_change(1) * 100
            df_wide[f"{col}_yoy"] = df_wide[col].pct_change(12) * 100

    # Real (inflation-adjusted) home price
    if "ohio_hpi_all_transactions" in df_wide.columns and "cpi_all_urban" in df_wide.columns:
        base_cpi = df_wide["cpi_all_urban"].iloc[0]
        df_wide["ohio_hpi_real"] = df_wide["ohio_hpi_all_transactions"] / df_wide["cpi_all_urban"] * base_cpi

    # Affordability composite
    if all(c in df_wide.columns for c in ["ohio_median_listing_price", "mortgage_rate_30yr_fixed"]):
        # Affordability = income needed / median income (lower = more affordable)
        r = df_wide["mortgage_rate_30yr_fixed"] / 100 / 12
        n = 360
        price = df_wide["ohio_median_listing_price"] * 0.8
        monthly_pmt = (price * r * (1 + r)**n) / ((1 + r)**n - 1)
        df_wide["affordability_monthly_pmt"] = monthly_pmt

    logger.info(f"  Time-series features: {df_wide.shape}")
    return df_wide


def build_market_heat_index(conn: duckdb.DuckDBPyConnection) -> pd.DataFrame:
    """Build market heat index from available metrics."""
    logger.info("Building market heat index...")

    # Use census data to approximate heat
    query = """
    SELECT
        h.county_fips,
        c.county_name,
        c.metro_area,
        c.region,
        h.year,
        h.median_home_value,
        h.home_value_yoy,
        h.vacancy_rate,
        h.homeownership_rate,
        h.affordability_ratio,
        h.median_household_income,
        h.total_population,
        -- Compute heat components
        CASE
            WHEN h.home_value_yoy > 10 THEN 3
            WHEN h.home_value_yoy > 5 THEN 2
            WHEN h.home_value_yoy > 0 THEN 1
            ELSE 0
        END AS price_growth_score,
        CASE
            WHEN h.vacancy_rate < 3 THEN 3
            WHEN h.vacancy_rate < 5 THEN 2
            WHEN h.vacancy_rate < 8 THEN 1
            ELSE 0
        END AS low_vacancy_score,
        CASE
            WHEN h.affordability_ratio < 25 THEN 3
            WHEN h.affordability_ratio < 30 THEN 2
            WHEN h.affordability_ratio < 35 THEN 1
            ELSE 0
        END AS affordability_score
    FROM ohio_re.fact_census_housing h
    JOIN ohio_re.dim_county c ON h.county_fips = c.county_fips
    WHERE h.year = 2023
    """

    df = conn.execute(query).df()

    # Composite heat score (0-9)
    df["market_heat_score"] = (
        df["price_growth_score"] +
        df["low_vacancy_score"] +
        df["affordability_score"]
    )

    # Normalize to 0-100
    max_score = df["market_heat_score"].max()
    df["market_heat_normalized"] = (df["market_heat_score"] / max_score * 100).round(1)

    # Market classification
    df["market_type"] = pd.cut(
        df["market_heat_normalized"],
        bins=[0, 30, 50, 70, 100],
        labels=["Buyer's Market", "Balanced", "Seller's Market", "Hot Market"],
        include_lowest=True
    )

    logger.info(f"  Market heat index: {df.shape}")
    return df


def main():
    logger.info("=" * 60)
    logger.info("Ohio Real Estate - Feature Engineering")
    logger.info("=" * 60)

    conn = duckdb.connect(str(DB_PATH), read_only=True)

    try:
        # County features
        county_features = build_county_features(conn)
        county_features.to_parquet(PROCESSED_DIR / "county_features.parquet", index=False)
        county_features.to_csv(PROCESSED_DIR / "county_features.csv", index=False)
        logger.info(f"Saved county features: {county_features.shape}")

        # Time series features
        ts_features = build_time_series_features(conn)
        ts_features.to_parquet(PROCESSED_DIR / "timeseries_features.parquet", index=False)
        ts_features.to_csv(PROCESSED_DIR / "timeseries_features.csv", index=False)
        logger.info(f"Saved time-series features: {ts_features.shape}")

        # Market heat index
        heat_index = build_market_heat_index(conn)
        heat_index.to_parquet(PROCESSED_DIR / "market_heat_index.parquet", index=False)
        heat_index.to_csv(PROCESSED_DIR / "market_heat_index.csv", index=False)
        logger.info(f"Saved market heat index: {heat_index.shape}")

        # Print summary stats
        logger.info("\n=== Feature Summary ===")
        logger.info(f"County features shape: {county_features.shape}")
        logger.info(f"Time-series features shape: {ts_features.shape}")
        logger.info(f"Market heat index shape: {heat_index.shape}")

        logger.info("\n=== Top 10 Counties by 2023 Median Home Value ===")
        top10 = county_features[county_features["year"] == 2023].nlargest(10, "median_home_value")[
            ["county_name", "median_home_value", "home_value_yoy", "affordability_ratio", "market_heat_normalized"]
        ] if "market_heat_normalized" in county_features.columns else county_features[
            county_features["year"] == 2023
        ].nlargest(10, "median_home_value")[
            ["county_name", "median_home_value", "home_value_yoy", "affordability_ratio"]
        ]
        logger.info(f"\n{top10.to_string()}")

    finally:
        conn.close()

    logger.info("\nFeature engineering complete!")


if __name__ == "__main__":
    main()
