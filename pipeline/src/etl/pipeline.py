"""
Ohio Real Estate Market Intelligence Platform
ETL Pipeline: Transforms raw data into a DuckDB analytical warehouse
Implements star schema with fact and dimension tables
"""

import duckdb
import pandas as pd
import numpy as np
from pathlib import Path
import json
import logging
from datetime import datetime

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent.parent
RAW_DIR = BASE_DIR / "data" / "raw"
PROCESSED_DIR = BASE_DIR / "data" / "processed"
WAREHOUSE_DIR = BASE_DIR / "data" / "warehouse"

for d in [PROCESSED_DIR, WAREHOUSE_DIR]:
    d.mkdir(parents=True, exist_ok=True)

DB_PATH = WAREHOUSE_DIR / "ohio_realestate.duckdb"

# Ohio county FIPS to metro area mapping
COUNTY_TO_METRO = {
    "39035": "Cleveland-Elyria", "39055": "Cleveland-Elyria", "39085": "Cleveland-Elyria",
    "39093": "Cleveland-Elyria", "39103": "Cleveland-Elyria",
    "39049": "Columbus", "39041": "Columbus", "39045": "Columbus",
    "39089": "Columbus", "39097": "Columbus", "39117": "Columbus", "39127": "Columbus",
    "39061": "Cincinnati", "39025": "Cincinnati", "39165": "Cincinnati",
    "39113": "Dayton", "39057": "Dayton", "39109": "Dayton",
    "39153": "Akron", "39133": "Akron",
    "39095": "Toledo", "39051": "Toledo",
    "39155": "Youngstown-Warren", "39099": "Youngstown-Warren",
    "39007": "Ashtabula", "39009": "Athens", "39013": "Belmont",
    "39019": "Canton-Massillon", "39151": "Canton-Massillon",
    "39173": "Weirton-Steubenville",
}

OHIO_REGIONS = {
    "Northeast": ["39035", "39055", "39085", "39093", "39103", "39153", "39133",
                  "39155", "39099", "39007", "39019", "39151"],
    "Central": ["39049", "39041", "39045", "39089", "39097", "39117", "39127",
                "39047", "39083"],
    "Southwest": ["39061", "39025", "39165", "39113", "39057", "39109"],
    "Northwest": ["39095", "39051", "39003", "39011", "39039", "39069"],
    "Southeast": ["39009", "39013", "39053", "39073", "39079", "39111",
                  "39141", "39163", "39167"],
}

# Reverse lookup
FIPS_TO_REGION = {fips: region for region, fips_list in OHIO_REGIONS.items() for fips in fips_list}


class OhioRealEstateETL:
    """ETL pipeline for Ohio Real Estate data warehouse."""

    def __init__(self, db_path: Path = DB_PATH):
        self.db_path = db_path
        self.conn = duckdb.connect(str(db_path))
        logger.info(f"Connected to DuckDB: {db_path}")

    def close(self):
        self.conn.close()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()

    # -------------------------------------------------------------------------
    # Schema creation
    # -------------------------------------------------------------------------
    def create_schema(self):
        """Create star schema tables."""
        logger.info("Creating warehouse schema...")

        self.conn.execute("CREATE SCHEMA IF NOT EXISTS ohio_re;")

        # Drop in dependency order (facts first, then dims)
        for tbl in [
            "ohio_re.mart_county_summary",
            "ohio_re.fact_census_housing",
            "ohio_re.fact_market_monthly",
            "ohio_re.fact_economic_indicators",
            "ohio_re.dim_county",
            "ohio_re.dim_date",
        ]:
            self.conn.execute(f"DROP TABLE IF EXISTS {tbl} CASCADE")

        # Dimension: Counties
        self.conn.execute("""
            CREATE OR REPLACE TABLE ohio_re.dim_county (
                county_fips     VARCHAR PRIMARY KEY,
                county_name     VARCHAR NOT NULL,
                state           VARCHAR DEFAULT 'Ohio',
                metro_area      VARCHAR,
                region          VARCHAR,
                is_metro        BOOLEAN DEFAULT FALSE
            );
        """)

        # Dimension: Date
        self.conn.execute("""
            CREATE OR REPLACE TABLE ohio_re.dim_date (
                date_key        INTEGER PRIMARY KEY,
                full_date       DATE NOT NULL,
                year            INTEGER,
                quarter         INTEGER,
                month           INTEGER,
                month_name      VARCHAR,
                week_of_year    INTEGER,
                day_of_week     INTEGER,
                is_weekend      BOOLEAN
            );
        """)

        # Fact: Census Housing Metrics (annual, county level)
        self.conn.execute("""
            CREATE OR REPLACE TABLE ohio_re.fact_census_housing (
                id                          INTEGER PRIMARY KEY,
                county_fips                 VARCHAR REFERENCES ohio_re.dim_county(county_fips),
                year                        INTEGER,
                median_home_value           DOUBLE,
                median_gross_rent           DOUBLE,
                total_housing_units         DOUBLE,
                owner_occupied              DOUBLE,
                renter_occupied             DOUBLE,
                vacant_units                DOUBLE,
                occupied_units              DOUBLE,
                median_household_income     DOUBLE,
                total_population            DOUBLE,
                median_year_structure_built DOUBLE,
                median_rooms                DOUBLE,
                homeownership_rate          DOUBLE,
                vacancy_rate                DOUBLE,
                renter_rate                 DOUBLE,
                affordability_ratio         DOUBLE,
                -- YoY changes (computed)
                home_value_yoy              DOUBLE,
                rent_yoy                    DOUBLE,
                income_yoy                  DOUBLE
            );
        """)

        # Fact: Redfin Market Metrics (monthly, county/city level)
        self.conn.execute("""
            CREATE OR REPLACE TABLE ohio_re.fact_market_monthly (
                id                      INTEGER PRIMARY KEY,
                period_begin            DATE,
                period_end              DATE,
                region_type             VARCHAR,
                region_name             VARCHAR,
                county_fips             VARCHAR,
                state_code              VARCHAR DEFAULT 'OH',
                property_type           VARCHAR,
                median_sale_price       DOUBLE,
                median_sale_price_yoy   DOUBLE,
                median_list_price       DOUBLE,
                median_list_price_yoy   DOUBLE,
                median_ppsf             DOUBLE,
                median_ppsf_yoy         DOUBLE,
                homes_sold              DOUBLE,
                homes_sold_yoy          DOUBLE,
                new_listings            DOUBLE,
                new_listings_yoy        DOUBLE,
                inventory               DOUBLE,
                inventory_yoy           DOUBLE,
                months_of_supply        DOUBLE,
                median_dom              DOUBLE,
                avg_sale_to_list        DOUBLE,
                sold_above_list         DOUBLE,
                price_drops             DOUBLE,
                off_market_in_two_weeks DOUBLE,
                parent_metro_region     VARCHAR
            );
        """)

        # Fact: FRED Economic Indicators (time series)
        self.conn.execute("""
            CREATE OR REPLACE TABLE ohio_re.fact_economic_indicators (
                id              INTEGER PRIMARY KEY,
                date            DATE,
                series_id       VARCHAR,
                friendly_name   VARCHAR,
                category        VARCHAR,
                value           DOUBLE
            );
        """)

        # Mart: County Summary (pre-aggregated for dashboard)
        self.conn.execute("""
            CREATE OR REPLACE TABLE ohio_re.mart_county_summary (
                county_fips             VARCHAR,
                county_name             VARCHAR,
                metro_area              VARCHAR,
                region                  VARCHAR,
                -- Latest census values (2023)
                median_home_value_2023  DOUBLE,
                median_rent_2023        DOUBLE,
                median_income_2023      DOUBLE,
                homeownership_rate_2023 DOUBLE,
                vacancy_rate_2023       DOUBLE,
                total_population_2023   DOUBLE,
                -- 5-year changes
                home_value_5yr_change   DOUBLE,
                rent_5yr_change         DOUBLE,
                income_5yr_change       DOUBLE,
                -- Market metrics (latest Redfin)
                latest_median_sale_price DOUBLE,
                latest_median_dom        DOUBLE,
                latest_months_supply     DOUBLE,
                latest_homes_sold        DOUBLE,
                market_heat_score        DOUBLE,
                affordability_index      DOUBLE
            );
        """)

        logger.info("Schema created successfully")

    # -------------------------------------------------------------------------
    # Dimension loading
    # -------------------------------------------------------------------------
    def load_dim_county(self):
        """Load county dimension from Census data."""
        logger.info("Loading dim_county...")
        census_path = RAW_DIR / "census_acs_county_ohio.parquet"
        if not census_path.exists():
            logger.warning("Census parquet not found, skipping dim_county")
            return

        df = pd.read_parquet(census_path)
        counties = df[["county_fips", "county_name"]].drop_duplicates()
        counties["state"] = "Ohio"
        counties["metro_area"] = counties["county_fips"].map(COUNTY_TO_METRO)
        counties["region"] = counties["county_fips"].map(FIPS_TO_REGION)
        counties["is_metro"] = counties["metro_area"].notna()

        self.conn.execute("DELETE FROM ohio_re.dim_county")
        self.conn.execute("INSERT INTO ohio_re.dim_county SELECT * FROM counties")
        logger.info(f"  Loaded {len(counties)} counties")

    def load_dim_date(self):
        """Generate date dimension from 2015 to 2027."""
        logger.info("Loading dim_date...")
        dates = pd.date_range("2015-01-01", "2027-12-31", freq="D")
        df = pd.DataFrame({
            "date_key": dates.strftime("%Y%m%d").astype(int),
            "full_date": dates.date,
            "year": dates.year,
            "quarter": dates.quarter,
            "month": dates.month,
            "month_name": dates.strftime("%B"),
            "week_of_year": dates.isocalendar().week.values,
            "day_of_week": dates.dayofweek,
            "is_weekend": dates.dayofweek >= 5,
        })
        self.conn.execute("DELETE FROM ohio_re.dim_date")
        self.conn.execute("INSERT INTO ohio_re.dim_date SELECT * FROM df")
        logger.info(f"  Loaded {len(df):,} date records")

    # -------------------------------------------------------------------------
    # Fact table loading
    # -------------------------------------------------------------------------
    def load_fact_census_housing(self):
        """Transform and load Census ACS housing data."""
        logger.info("Loading fact_census_housing...")
        path = RAW_DIR / "census_acs_county_ohio.parquet"
        if not path.exists():
            logger.warning("Census parquet not found")
            return

        df = pd.read_parquet(path)

        # Compute derived metrics
        df["homeownership_rate"] = (df["owner_occupied"] / df["total_housing_units_tenure"] * 100).round(2)
        df["vacancy_rate"] = (df["vacant_units"] / df["total_units_vacancy"] * 100).round(2)
        df["renter_rate"] = (df["renter_occupied"] / df["total_housing_units_tenure"] * 100).round(2)
        # Affordability: annual rent as % of income
        df["affordability_ratio"] = ((df["median_gross_rent"] * 12) / df["median_household_income"] * 100).round(2)

        # YoY changes
        df = df.sort_values(["county_fips", "year"])
        for col, new_col in [
            ("median_home_value", "home_value_yoy"),
            ("median_gross_rent", "rent_yoy"),
            ("median_household_income", "income_yoy"),
        ]:
            df[new_col] = df.groupby("county_fips")[col].pct_change() * 100

        # Select columns for fact table
        fact_cols = [
            "county_fips", "year", "median_home_value", "median_gross_rent",
            "total_housing_units", "owner_occupied", "renter_occupied",
            "vacant_units", "occupied_units", "median_household_income",
            "total_population", "median_year_structure_built", "median_rooms",
            "homeownership_rate", "vacancy_rate", "renter_rate", "affordability_ratio",
            "home_value_yoy", "rent_yoy", "income_yoy",
        ]
        available = [c for c in fact_cols if c in df.columns]
        fact_df = df[available].copy()
        fact_df = fact_df.reset_index(drop=True)
        fact_df.insert(0, "id", range(1, len(fact_df) + 1))

        self.conn.execute("DELETE FROM ohio_re.fact_census_housing")
        self.conn.execute("INSERT INTO ohio_re.fact_census_housing SELECT * FROM fact_df")
        logger.info(f"  Loaded {len(fact_df):,} census housing records")

        # Save processed
        fact_df.to_parquet(PROCESSED_DIR / "fact_census_housing.parquet", index=False)

    def load_fact_market_monthly(self):
        """Transform and load Redfin market data."""
        logger.info("Loading fact_market_monthly...")

        frames = []
        for level in ["county", "city", "state"]:
            path = RAW_DIR / f"redfin_{level}_ohio.parquet"
            if path.exists():
                df = pd.read_parquet(path)
                df["region_type"] = level
                frames.append(df)
                logger.info(f"  Found {level}: {len(df):,} rows")

        if not frames:
            logger.warning("No Redfin data found")
            return

        combined = pd.concat(frames, ignore_index=True)

        # Standardize region name column
        if "region" in combined.columns:
            combined["region_name"] = combined["region"]
        elif "city" in combined.columns:
            combined["region_name"] = combined["city"]
        else:
            combined["region_name"] = "Ohio"

        # Map county names to FIPS
        county_fips_map = {}
        census_path = RAW_DIR / "census_acs_county_ohio.parquet"
        if census_path.exists():
            census = pd.read_parquet(census_path)
            for _, row in census[["county_name", "county_fips"]].drop_duplicates().iterrows():
                county_fips_map[row["county_name"].lower()] = row["county_fips"]

        def get_fips(row):
            name = str(row.get("region_name", "")).lower().replace(" county", "")
            return county_fips_map.get(name, None)

        combined["county_fips"] = combined.apply(get_fips, axis=1)

        # Select fact columns
        fact_cols = [
            "period_begin", "period_end", "region_type", "region_name", "county_fips",
            "property_type",
            "median_sale_price", "median_sale_price_yoy",
            "median_list_price", "median_list_price_yoy",
            "median_ppsf", "median_ppsf_yoy",
            "homes_sold", "homes_sold_yoy",
            "new_listings", "new_listings_yoy",
            "inventory", "inventory_yoy",
            "months_of_supply", "median_dom",
            "avg_sale_to_list", "sold_above_list",
            "price_drops", "off_market_in_two_weeks",
            "parent_metro_region",
        ]
        available = [c for c in fact_cols if c in combined.columns]
        fact_df = combined[available].copy()
        fact_df["state_code"] = "OH"
        fact_df = fact_df.reset_index(drop=True)
        fact_df.insert(0, "id", range(1, len(fact_df) + 1))

        # Ensure column order matches schema exactly
        schema_cols = [
            "id", "period_begin", "period_end", "region_type", "region_name", "county_fips",
            "state_code", "property_type",
            "median_sale_price", "median_sale_price_yoy",
            "median_list_price", "median_list_price_yoy",
            "median_ppsf", "median_ppsf_yoy",
            "homes_sold", "homes_sold_yoy",
            "new_listings", "new_listings_yoy",
            "inventory", "inventory_yoy",
            "months_of_supply", "median_dom",
            "avg_sale_to_list", "sold_above_list",
            "price_drops", "off_market_in_two_weeks",
            "parent_metro_region",
        ]
        ordered_cols = [c for c in schema_cols if c in fact_df.columns]
        # Add missing columns as NULL
        for c in schema_cols:
            if c not in fact_df.columns:
                fact_df[c] = None
        fact_df = fact_df[schema_cols]
        self.conn.execute("DELETE FROM ohio_re.fact_market_monthly")
        self.conn.execute("INSERT INTO ohio_re.fact_market_monthly SELECT * FROM fact_df")
        logger.info(f"  Loaded {len(fact_df):,} market monthly records")

        fact_df.to_parquet(PROCESSED_DIR / "fact_market_monthly.parquet", index=False)

    def load_fact_economic_indicators(self):
        """Load FRED economic indicator data."""
        logger.info("Loading fact_economic_indicators...")
        path = RAW_DIR / "fred_ohio_long.parquet"
        if not path.exists():
            logger.warning("FRED long parquet not found")
            return

        df = pd.read_parquet(path)
        # Select only columns matching the fact table schema
        fact_cols = ["date", "series_id", "friendly_name", "category", "value"]
        available = [c for c in fact_cols if c in df.columns]
        df = df[available].copy()
        df = df.reset_index(drop=True)
        df.insert(0, "id", range(1, len(df) + 1))

        self.conn.execute("DELETE FROM ohio_re.fact_economic_indicators")
        self.conn.execute("INSERT INTO ohio_re.fact_economic_indicators SELECT * FROM df")
        logger.info(f"  Loaded {len(df):,} economic indicator records")

        df.to_parquet(PROCESSED_DIR / "fact_economic_indicators.parquet", index=False)

    # -------------------------------------------------------------------------
    # Data mart building
    # -------------------------------------------------------------------------
    def build_mart_county_summary(self):
        """Build pre-aggregated county summary mart."""
        logger.info("Building mart_county_summary...")

        query = """
        WITH census_latest AS (
            SELECT
                c.county_fips,
                c.county_name,
                c.metro_area,
                c.region,
                h.median_home_value   AS median_home_value_2023,
                h.median_gross_rent   AS median_rent_2023,
                h.median_household_income AS median_income_2023,
                h.homeownership_rate  AS homeownership_rate_2023,
                h.vacancy_rate        AS vacancy_rate_2023,
                h.total_population    AS total_population_2023
            FROM ohio_re.dim_county c
            LEFT JOIN ohio_re.fact_census_housing h
                ON c.county_fips = h.county_fips AND h.year = 2023
        ),
        census_2019 AS (
            SELECT county_fips,
                   median_home_value AS home_value_2019,
                   median_gross_rent AS rent_2019,
                   median_household_income AS income_2019
            FROM ohio_re.fact_census_housing
            WHERE year = 2019
        ),
        market_latest AS (
            SELECT
                county_fips,
                LAST(median_sale_price ORDER BY period_begin) AS latest_median_sale_price,
                LAST(median_dom ORDER BY period_begin)        AS latest_median_dom,
                LAST(months_of_supply ORDER BY period_begin)  AS latest_months_supply,
                LAST(homes_sold ORDER BY period_begin)        AS latest_homes_sold
            FROM ohio_re.fact_market_monthly
            WHERE region_type = 'county'
              AND property_type = 'All Residential'
            GROUP BY county_fips
        )
        SELECT
            cl.county_fips,
            cl.county_name,
            cl.metro_area,
            cl.region,
            cl.median_home_value_2023,
            cl.median_rent_2023,
            cl.median_income_2023,
            cl.homeownership_rate_2023,
            cl.vacancy_rate_2023,
            cl.total_population_2023,
            -- 5-year changes
            ROUND((cl.median_home_value_2023 - c19.home_value_2019) / NULLIF(c19.home_value_2019, 0) * 100, 2) AS home_value_5yr_change,
            ROUND((cl.median_rent_2023 - c19.rent_2019) / NULLIF(c19.rent_2019, 0) * 100, 2) AS rent_5yr_change,
            ROUND((cl.median_income_2023 - c19.income_2019) / NULLIF(c19.income_2019, 0) * 100, 2) AS income_5yr_change,
            -- Market metrics
            ml.latest_median_sale_price,
            ml.latest_median_dom,
            ml.latest_months_supply,
            ml.latest_homes_sold,
            -- Market heat score (0-100): low DOM + low supply + high sale/list + high above-list
            ROUND(
                CASE
                    WHEN ml.latest_months_supply IS NULL THEN NULL
                    ELSE LEAST(100, GREATEST(0,
                        (6 - COALESCE(ml.latest_months_supply, 3)) * 10 +
                        (45 - COALESCE(ml.latest_median_dom, 30)) * 0.5 +
                        50
                    ))
                END, 1
            ) AS market_heat_score,
            -- Affordability index: 100 = median income can afford median home
            ROUND(
                CASE
                    WHEN cl.median_income_2023 IS NULL OR cl.median_home_value_2023 IS NULL THEN NULL
                    ELSE (cl.median_income_2023 * 5) / NULLIF(cl.median_home_value_2023, 0) * 100
                END, 1
            ) AS affordability_index
        FROM census_latest cl
        LEFT JOIN census_2019 c19 ON cl.county_fips = c19.county_fips
        LEFT JOIN market_latest ml ON cl.county_fips = ml.county_fips
        ORDER BY cl.county_name
        """

        try:
            mart_df = self.conn.execute(query).df()
            self.conn.execute("DELETE FROM ohio_re.mart_county_summary")
            self.conn.execute("INSERT INTO ohio_re.mart_county_summary SELECT * FROM mart_df")
            mart_df.to_parquet(PROCESSED_DIR / "mart_county_summary.parquet", index=False)
            mart_df.to_csv(PROCESSED_DIR / "mart_county_summary.csv", index=False)
            logger.info(f"  Built county summary mart: {len(mart_df)} rows")
        except Exception as e:
            logger.error(f"  Error building mart: {e}")
            import traceback
            traceback.print_exc()

    # -------------------------------------------------------------------------
    # Run full pipeline
    # -------------------------------------------------------------------------
    def run(self):
        """Execute full ETL pipeline."""
        start = datetime.now()
        logger.info("=" * 60)
        logger.info("Ohio Real Estate ETL Pipeline Starting")
        logger.info("=" * 60)

        self.create_schema()
        self.load_dim_county()
        self.load_dim_date()
        self.load_fact_census_housing()
        self.load_fact_market_monthly()
        self.load_fact_economic_indicators()
        self.build_mart_county_summary()

        # Export summary stats
        self._export_summary()

        elapsed = (datetime.now() - start).total_seconds()
        logger.info(f"\nETL Pipeline complete in {elapsed:.1f}s")
        logger.info(f"Warehouse: {DB_PATH}")

    def _export_summary(self):
        """Export row counts and basic stats."""
        tables = [
            "ohio_re.dim_county", "ohio_re.dim_date",
            "ohio_re.fact_census_housing", "ohio_re.fact_market_monthly",
            "ohio_re.fact_economic_indicators", "ohio_re.mart_county_summary",
        ]
        summary = {}
        for t in tables:
            try:
                count = self.conn.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
                summary[t] = count
                logger.info(f"  {t}: {count:,} rows")
            except Exception as e:
                summary[t] = f"ERROR: {e}"

        with open(WAREHOUSE_DIR / "etl_summary.json", "w") as f:
            json.dump({
                "run_timestamp": datetime.now().isoformat(),
                "table_counts": summary,
                "db_path": str(DB_PATH),
            }, f, indent=2)


if __name__ == "__main__":
    with OhioRealEstateETL() as etl:
        etl.run()
