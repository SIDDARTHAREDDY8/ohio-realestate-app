/*
 * About — Data Terminal style
 * Methodology, data quality, schema docs, pipeline architecture
 * Looks like a data engineer's internal wiki, not a marketing page
 */

import { ExternalLink } from "lucide-react";

function SectionHeader({ title, source, url }: { title: string; source?: string; url?: string }) {
  return (
    <div className="section-header">
      <span className="section-title">{title}</span>
      {source && (
        <span className="source-tag flex items-center gap-1">
          {url ? (
            <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-0.5 hover:underline">
              {source} <ExternalLink className="w-2.5 h-2.5" />
            </a>
          ) : source}
        </span>
      )}
    </div>
  );
}

const DATA_SOURCES = [
  {
    name: "US Census Bureau — ACS 5-Year Estimates",
    url: "https://www.census.gov/data/developers/data-sets/acs-5year.html",
    api: "https://api.census.gov/data/2023/acs/acs5",
    tables: ["B25077 (median home value)", "B25064 (gross rent)", "B25003 (tenure)", "B25001 (housing units)", "B25002 (vacancy)", "B19013 (median income)", "B01003 (population)", "B25035 (year built)", "B25018 (rooms)"],
    coverage: "All 88 Ohio counties · 2019, 2020, 2021, 2022, 2023",
    limitations: "5-year rolling estimates — not point-in-time. 2020 data affected by COVID collection disruptions. Margin of error not shown in this dashboard.",
    records: "440 county-year records",
    license: "Public domain (US government data)",
  },
  {
    name: "Redfin Market Tracker",
    url: "https://www.redfin.com/news/data-center/",
    api: "https://redfin-public-data.s3.us-west-2.amazonaws.com/redfin_market_tracker/county_market_tracker.tsv000.gz",
    tables: ["median_sale_price", "median_list_price", "median_ppsf", "homes_sold", "inventory", "months_of_supply", "median_dom", "avg_sale_to_list", "sold_above_list", "price_drops"],
    coverage: "All 88 Ohio counties · Jan 2012 – Mar 2026 · Monthly",
    limitations: "Redfin coverage varies by county — rural counties may have sparse data. Metrics represent only homes listed/sold through Redfin-tracked MLSs.",
    records: "48,172 county-month records",
    license: "Redfin Data Terms of Use — free for non-commercial use with attribution",
  },
  {
    name: "FRED — Federal Reserve Bank of St. Louis",
    url: "https://fred.stlouisfed.org/",
    api: "https://api.stlouisfed.org/fred/series/observations",
    tables: ["OHSTHPI (Ohio HPI)", "MEDLISPRIOH (listing price)", "ACTLISCOUOH (active listings)", "MORTGAGE30US (30-yr rate)", "FEDFUNDS (fed funds)", "OHUR (unemployment)", "OHNA (employment)", "ATNHPIUS18140Q (Cleveland HPI)", "ATNHPIUS17460Q (Columbus HPI)", "ATNHPIUS17140Q (Cincinnati HPI)", "CSUSHPINSA (Case-Shiller)", "CPIAUCSL (CPI)", "UMCSENT (sentiment)"],
    coverage: "2015–2026 · Monthly/Quarterly depending on series",
    limitations: "FRED JSON API requires a free API key for browser-side calls. Without a key, the dashboard uses cached data from the last pipeline run.",
    records: "2,934 observations across 21 series",
    license: "Public domain (Federal Reserve data)",
  },
];

const SCHEMA = [
  { table: "ohio_re.dim_county", type: "Dimension", rows: "88", key: "county_fips (CHAR 5)", desc: "County name, FIPS code, metro area, region classification" },
  { table: "ohio_re.dim_date", type: "Dimension", rows: "4,748", key: "date_key (INT)", desc: "Date dimension 2015–2027 with year/quarter/month/week attributes" },
  { table: "ohio_re.fact_census_housing", type: "Fact", rows: "440", key: "county_fips + year", desc: "Annual ACS housing metrics per county with derived rates and YoY changes" },
  { table: "ohio_re.fact_market_monthly", type: "Fact", rows: "48,172", key: "county_fips + period_begin + property_type", desc: "Monthly Redfin market metrics per county" },
  { table: "ohio_re.fact_economic_indicators", type: "Fact", rows: "2,934", key: "series_id + date", desc: "FRED economic time series in long format" },
  { table: "ohio_re.mart_county_summary", type: "Mart", rows: "88", key: "county_fips", desc: "Pre-aggregated county summary with 5-year changes and affordability metrics" },
];

const ML_MODELS = [
  {
    name: "County Home Value Predictor",
    algorithm: "XGBoost Regressor",
    framework: "xgboost 2.0 + scikit-learn 1.4",
    target: "median_home_value (continuous)",
    features: "21 features: income, rent, lag values, housing stock age, vacancy rate, region dummies",
    train_test: "80/20 random split · 5-fold cross-validation",
    metrics: "R²=0.9856 · MAE=$3,389 · MAPE=2.04% · CV R²=0.977±0.015",
    notes: "Lag features (prior year home value) account for 47% of feature importance. Model is retrained monthly on latest ACS data.",
  },
  {
    name: "Ohio HPI Forecaster",
    algorithm: "Facebook Prophet",
    framework: "prophet 1.1.5",
    target: "OHSTHPI quarterly index value",
    features: "3 external regressors: mortgage_rate_30yr_fixed, ohio_unemployment_rate, federal_funds_rate",
    train_test: "36 quarters train / 8 quarters test",
    metrics: "Multiplicative seasonality · changepoint_prior_scale=0.1 · 95% confidence interval",
    notes: "Quarterly data limits forecast accuracy. The 2022–2023 rate shock created a structural break that challenges the model.",
  },
  {
    name: "Market Cluster Analysis",
    algorithm: "K-Means (k=5)",
    framework: "scikit-learn 1.4",
    target: "Unsupervised — no target variable",
    features: "9 features: home value, income, homeownership, vacancy, affordability ratio, price-to-income, appreciation, housing age, population",
    train_test: "All 88 counties · elbow method tested k=2–8",
    metrics: "Inertia=369.3 at k=5 · StandardScaler preprocessing · 20 random initializations",
    notes: "76 of 88 counties cluster into 'Value Market' — Ohio is predominantly affordable relative to coastal markets.",
  },
  {
    name: "Affordability Risk Classifier",
    algorithm: "Random Forest Classifier",
    framework: "scikit-learn 1.4",
    target: "4-class: Low Risk / Moderate / High Risk / Severe",
    features: "11 features: home value, income, rent, homeownership, vacancy, population, price-to-income, YoY changes, metro flag, year",
    train_test: "80/20 stratified split",
    metrics: "Accuracy=0.89+ · Classes derived from affordability ratio quartiles",
    notes: "Affordability Index = (5 × median income) / median home value × 100. Index ≥ 100 = household earning median income can afford median home at 20% down, 30-yr mortgage.",
  },
];

const PIPELINE_STEPS = [
  { step: "01", name: "scripts/01_fetch_census_data.py", desc: "Calls Census ACS API for all 88 Ohio counties across 5 years. No API key required. Rate-limited to 0.5s between years." },
  { step: "02", name: "scripts/02_fetch_redfin_data.py", desc: "Downloads county_market_tracker.tsv000.gz from Redfin S3 (~1.5 GB), decompresses in-memory, filters state_code='OH', saves 48K rows." },
  { step: "03", name: "scripts/03_fetch_fred_data.py", desc: "Downloads 21 FRED series via direct CSV endpoint (no API key). Saves long format (2,934 obs) and wide format (711 rows × 22 cols)." },
  { step: "04", name: "src/etl/pipeline.py", desc: "OhioRealEstateETL class builds DuckDB star schema. Drops tables in dependency order, recreates, loads dimensions then facts, builds mart." },
  { step: "05", name: "src/etl/feature_engineering.py", desc: "Builds 46-feature county matrix with lag features (1yr, 2yr), rolling averages, derived ratios, region dummies. Computes market heat index." },
  { step: "06", name: "src/models/train_models.py", desc: "Trains 4 models sequentially. Serializes artifacts to warehouse/models/ as pickle. Writes JSON metrics files for dashboard consumption." },
  { step: "07", name: "pipeline/run_pipeline.py", desc: "Orchestrator: patches BASE_DIR in scripts, runs steps 1–6, exports 10 JSON files to client/src/data/, writes pipeline_meta.json with timestamp." },
];

export default function About() {
  return (
    <div className="p-4 space-y-4 max-w-5xl">

      {/* Project header */}
      <div className="panel">
        <SectionHeader title="Ohio Real Estate Market Intelligence Platform — Technical Reference" />
        <div className="p-4 space-y-2 text-sm" style={{ lineHeight: 1.7 }}>
          <p>
            End-to-end data engineering project: automated ETL pipeline ingesting three public data sources into a DuckDB analytical warehouse,
            four trained ML models (regression, time-series forecasting, clustering, classification), and a React dashboard serving both
            cached and live data. Built to demonstrate production data engineering patterns — not a tutorial project.
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            {["Python 3.11", "DuckDB 0.10", "XGBoost 2.0", "Prophet 1.1", "scikit-learn 1.4", "React 19", "TypeScript", "Recharts", "GitHub Actions"].map(t => (
              <code key={t} className="text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--muted)", fontFamily: "'IBM Plex Mono', monospace" }}>{t}</code>
            ))}
          </div>
        </div>
      </div>

      {/* Data sources */}
      <div className="panel">
        <SectionHeader title="Data Sources — Provenance & Limitations" />
        <div className="divide-y" style={{ borderColor: "var(--border)" }}>
          {DATA_SOURCES.map(src => (
            <div key={src.name} className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="text-sm font-semibold">{src.name}</div>
                <a href={src.url} target="_blank" rel="noopener noreferrer" className="source-tag flex items-center gap-0.5 hover:underline ml-4 flex-shrink-0">
                  Source <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="font-semibold mb-1" style={{ color: "var(--muted-foreground)" }}>API ENDPOINT</div>
                  <code className="source-tag break-all">{src.api}</code>
                </div>
                <div>
                  <div className="font-semibold mb-1" style={{ color: "var(--muted-foreground)" }}>COVERAGE</div>
                  <div className="source-tag">{src.coverage}</div>
                  <div className="source-tag mt-0.5">{src.records} · {src.license}</div>
                </div>
                <div>
                  <div className="font-semibold mb-1" style={{ color: "var(--muted-foreground)" }}>VARIABLES USED</div>
                  <div className="source-tag">{src.tables.join(" · ")}</div>
                </div>
                <div>
                  <div className="font-semibold mb-1" style={{ color: "var(--destructive)" }}>KNOWN LIMITATIONS</div>
                  <div className="source-tag">{src.limitations}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Warehouse schema */}
      <div className="panel">
        <SectionHeader title="DuckDB Warehouse Schema — Star Schema" source="pipeline/src/etl/pipeline.py" />
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Table</th>
                <th>Type</th>
                <th>Rows</th>
                <th>Primary Key</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {SCHEMA.map(s => (
                <tr key={s.table}>
                  <td><code className="source-tag">{s.table}</code></td>
                  <td><span className="source-tag">{s.type}</span></td>
                  <td className="mono">{s.rows}</td>
                  <td><code className="source-tag">{s.key}</code></td>
                  <td className="source-tag">{s.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-3 py-2 source-tag" style={{ borderTop: "1px solid var(--border)" }}>
          Warehouse file: pipeline/data/warehouse/ohio_realestate.duckdb · Schema: ohio_re · Engine: DuckDB 0.10 (columnar, in-process)
        </div>
      </div>

      {/* ML models */}
      <div className="panel">
        <SectionHeader title="ML Model Specifications" source="pipeline/src/models/train_models.py" />
        <div className="divide-y" style={{ borderColor: "var(--border)" }}>
          {ML_MODELS.map(m => (
            <div key={m.name} className="p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="text-sm font-semibold">{m.name}</div>
                <code className="source-tag">{m.algorithm}</code>
                <code className="source-tag">{m.framework}</code>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 text-xs">
                <div><span style={{ color: "var(--muted-foreground)" }}>Target: </span><span className="source-tag">{m.target}</span></div>
                <div><span style={{ color: "var(--muted-foreground)" }}>Validation: </span><span className="source-tag">{m.train_test}</span></div>
                <div><span style={{ color: "var(--muted-foreground)" }}>Features: </span><span className="source-tag">{m.features}</span></div>
                <div><span style={{ color: "oklch(0.48 0.16 145)" }}>Metrics: </span><span className="source-tag font-semibold">{m.metrics}</span></div>
                <div className="lg:col-span-2"><span style={{ color: "var(--muted-foreground)" }}>Notes: </span><span className="source-tag">{m.notes}</span></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pipeline */}
      <div className="panel">
        <SectionHeader title="ETL Pipeline — Execution Order" source="pipeline/run_pipeline.py" />
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr><th>Step</th><th>Script</th><th>Description</th></tr>
            </thead>
            <tbody>
              {PIPELINE_STEPS.map(s => (
                <tr key={s.step}>
                  <td className="mono" style={{ color: "var(--muted-foreground)" }}>{s.step}</td>
                  <td><code className="source-tag">{s.name}</code></td>
                  <td className="source-tag">{s.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-3 py-2 source-tag" style={{ borderTop: "1px solid var(--border)" }}>
          GitHub Actions: .github/workflows/refresh-data.yml · Schedule: cron "0 6 1 * *" (1st of month, 06:00 UTC) · Runner: ubuntu-latest · Timeout: 90 min
        </div>
      </div>

      {/* Corporate Links */}
      <div className="panel p-4">
        <div className="flex flex-wrap gap-6 justify-center">
          <a href="https://github.com/SIDDARTHAREDDY8/ohio-realestate-app" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm font-semibold hover:underline">
            GitHub Repository <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <a href="https://github.com/SIDDARTHAREDDY8/ohio-realestate-app/blob/main/docs/METHODOLOGY.md" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm font-semibold hover:underline">
            Methodology & Governance <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <a href="https://github.com/SIDDARTHAREDDY8/ohio-realestate-app/blob/main/docs/MODEL_CARD_HOME_VALUE.md" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm font-semibold hover:underline">
            Model Card: Home Value Predictor <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

    </div>
  );
}
