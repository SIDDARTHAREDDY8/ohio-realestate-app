/*
 * About — Data Terminal style
 * Methodology, data quality, schema docs, pipeline architecture
 * Looks like a data engineer's internal wiki, not a marketing page
 */

import { ExternalLink } from "lucide-react";
import pipelineMeta from "@/data/pipeline_meta.json";
import modelMetrics from "@/data/model_metrics.json";

// Live numbers from the last pipeline/training run — displayed stats can
// never drift from what the pipeline actually produced.
const meta = pipelineMeta as any;
const mm = modelMetrics as any;
const hv = mm.home_value ?? {};
const hpi = mm.hpi_forecast ?? {};
const cl = mm.clusters ?? {};
const af = mm.affordability ?? {};
const hvBest = (hv.metrics ?? []).find((m: any) => m.model === hv.best_model) ?? {};
const fmtNum = (n: number | undefined | null) => (n != null ? n.toLocaleString("en-US") : "—");
const topCluster = Object.entries(cl.cluster_counts ?? {}).sort(
  (a: any, b: any) => b[1] - a[1]
)[0] as [string, number] | undefined;

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
    records: `${fmtNum(meta.census_rows)} county-year records`,
    license: "Public domain (US government data)",
  },
  {
    name: "Redfin Market Tracker",
    url: "https://www.redfin.com/news/data-center/",
    api: "https://redfin-public-data.s3.us-west-2.amazonaws.com/redfin_market_tracker/county_market_tracker.tsv000.gz",
    tables: ["median_sale_price", "median_list_price", "median_ppsf", "homes_sold", "inventory", "months_of_supply", "median_dom", "avg_sale_to_list", "sold_above_list", "price_drops"],
    coverage: `All 88 Ohio counties · ${meta.market_date_range ?? "monthly"} · Monthly`,
    limitations: "Redfin coverage varies by county — rural counties may have sparse data. Metrics represent only homes listed/sold through Redfin-tracked MLSs.",
    records: `${fmtNum(meta.market_rows)} county-month records`,
    license: "Redfin Data Terms of Use — free for non-commercial use with attribution",
  },
  {
    name: "FRED — Federal Reserve Bank of St. Louis",
    url: "https://fred.stlouisfed.org/",
    api: "https://api.stlouisfed.org/fred/series/observations",
    tables: ["OHSTHPI (Ohio HPI)", "MEDLISPRIOH (listing price)", "ACTLISCOUOH (active listings)", "MORTGAGE30US (30-yr rate)", "FEDFUNDS (fed funds)", "OHUR (unemployment)", "OHNA (employment)", "ATNHPIUS18140Q (Cleveland HPI)", "ATNHPIUS17460Q (Columbus HPI)", "ATNHPIUS17140Q (Cincinnati HPI)", "CSUSHPINSA (Case-Shiller)", "CPIAUCSL (CPI)", "UMCSENT (sentiment)"],
    coverage: "2015–2026 · Monthly/Quarterly depending on series",
    limitations: "FRED JSON API requires a free API key for browser-side calls. Without a key, the dashboard uses cached data from the last pipeline run.",
    records: `${fmtNum(meta.economic_rows)} observations across 21 series`,
    license: "Public domain (Federal Reserve data)",
  },
];

const SCHEMA = [
  { table: "ohio_re.dim_county", type: "Dimension", rows: "88", key: "county_fips (CHAR 5)", desc: "County name, FIPS code, metro area, region classification" },
  { table: "ohio_re.dim_date", type: "Dimension", rows: "4,748", key: "date_key (INT)", desc: "Date dimension 2015–2027 with year/quarter/month/week attributes" },
  { table: "ohio_re.fact_census_housing", type: "Fact", rows: fmtNum(meta.census_rows), key: "county_fips + year", desc: "Annual ACS housing metrics per county with derived rates and YoY changes" },
  { table: "ohio_re.fact_market_monthly", type: "Fact", rows: fmtNum(meta.market_rows), key: "county_fips + period_begin + property_type", desc: "Monthly Redfin market metrics per county" },
  { table: "ohio_re.fact_economic_indicators", type: "Fact", rows: fmtNum(meta.economic_rows), key: "series_id + date", desc: "FRED economic time series in long format" },
  { table: "ohio_re.mart_county_summary", type: "Mart", rows: "88", key: "county_fips", desc: "Pre-aggregated county summary with 5-year changes and affordability metrics" },
];

// Populated from model_metrics.json (last training run) — see the constants
// at the top of this file. Numbers here update automatically on retrain.
const ML_MODELS = [
  {
    name: "County Home Value Predictor",
    algorithm: `${hv.best_model ?? "Gradient-boosted"} Regressor`,
    framework: "xgboost 2.0 + scikit-learn 1.4",
    target: "median_home_value (continuous)",
    features: `${hv.n_features ?? 21} features: income, rent, lag values, housing stock age, vacancy rate, region dummies`,
    train_test: hv.validation ?? "temporal holdout (train on earlier years, test on the latest)",
    metrics: [
      hvBest.r2 != null ? `R²=${hvBest.r2}` : null,
      hvBest.mae != null ? `MAE=$${Math.round(hvBest.mae).toLocaleString("en-US")}` : null,
      hvBest.mape != null ? `MAPE=${hvBest.mape}%` : null,
      hv.cv_r2_mean != null ? `CV R²=${hv.cv_r2_mean.toFixed(3)}±${(hv.cv_r2_std ?? 0).toFixed(3)}` : null,
    ].filter(Boolean).join(" · ") || "See model_metrics.json",
    notes: "Validation is strictly temporal — lagged-target features never leak the answer. Retrained monthly on latest ACS data; the leaderboard picks the best model on the held-out year.",
  },
  {
    name: "Ohio HPI Forecaster",
    algorithm: "Facebook Prophet",
    framework: "prophet 1.1.5",
    target: "OHSTHPI quarterly index value",
    features: `${(hpi.regressors ?? []).length || 3} external regressors: mortgage_rate_30yr_fixed, ohio_unemployment_rate, federal_funds_rate`,
    train_test: hpi.n_train != null ? `${hpi.n_train} quarters train / ${hpi.n_test} quarters test` : "holdout on final 8 quarters",
    metrics: [
      hpi.test_r2 != null ? `Test R²=${hpi.test_r2}` : null,
      hpi.test_mae != null ? `Test MAE=${hpi.test_mae}` : null,
      "Multiplicative seasonality · 95% confidence interval",
    ].filter(Boolean).join(" · "),
    notes: "Quarterly data limits forecast accuracy. The 2022–2023 rate shock created a structural break that challenges the model. Future regressor values are carried forward from the last observation.",
  },
  {
    name: "Market Cluster Analysis",
    algorithm: `K-Means${cl.k ? ` (k=${cl.k})` : ""}`,
    framework: "scikit-learn 1.4",
    target: "Unsupervised — no target variable",
    features: "9 features: home value, income, homeownership, vacancy, affordability ratio, price-to-income, appreciation, housing age, population",
    train_test: `All 88 counties · ${cl.k_selection ?? "silhouette score tested k=3–8"}`,
    metrics: cl.silhouette_scores && cl.k != null
      ? `Silhouette=${cl.silhouette_scores[String(cl.k)]} at k=${cl.k} · StandardScaler preprocessing · 20 random initializations`
      : "StandardScaler preprocessing · 20 random initializations",
    notes: topCluster
      ? `${topCluster[1]} of 88 counties cluster into '${topCluster[0]}' — Ohio is predominantly affordable relative to coastal markets.`
      : "Ohio is predominantly affordable relative to coastal markets.",
  },
  {
    name: "Affordability Risk Classifier",
    algorithm: "Random Forest Classifier",
    framework: "scikit-learn 1.4",
    target: `${(af.classes ?? []).length || 4}-class: ${(af.classes ?? ["Low Risk", "Moderate", "High Risk", "Severe"]).join(" / ")}`,
    features: `${(af.features ?? []).length || 11} features — rent and income deliberately excluded (they define the target)`,
    train_test: af.validation ?? "temporal holdout on the latest year",
    metrics: af.accuracy != null
      ? `Accuracy=${af.accuracy} on the held-out year · Classes = training-year quartiles of rent-to-income ratio`
      : "Classes = training-year quartiles of rent-to-income ratio",
    notes: "Target = quartiles of annual rent ÷ household income, with quartile edges computed on training years only to avoid threshold leakage.",
  },
];

const PIPELINE_STEPS = [
  { step: "01", name: "scripts/01_fetch_census_data.py", desc: "Calls Census ACS API for all 88 Ohio counties across 5 years. No API key required. Rate-limited to 0.5s between years." },
  { step: "02", name: "scripts/02_fetch_redfin_data.py", desc: "Downloads county_market_tracker.tsv000.gz from Redfin S3 (~1.5 GB), streams to disk, filters state_code='OH' in chunks." },
  { step: "03", name: "scripts/03_fetch_fred_data.py", desc: "Downloads 21 FRED series via direct CSV endpoint (no API key). Saves long and wide parquet formats." },
  { step: "04", name: "src/etl/pipeline.py", desc: "OhioRealEstateETL class builds DuckDB star schema. Drops tables in dependency order, recreates, loads dimensions then facts, builds mart." },
  { step: "05", name: "src/etl/feature_engineering.py", desc: "Builds 46-feature county matrix with lag features (1yr, 2yr), rolling averages, derived ratios, region dummies. Computes market heat index." },
  { step: "06", name: "src/models/train_models.py", desc: "Trains 4 models sequentially. Serializes artifacts to warehouse/models/ as pickle. Writes JSON metrics files for dashboard consumption." },
  { step: "07", name: "pipeline/run_pipeline.py", desc: "Orchestrator: runs steps 1–6, exports JSON files (incl. model_metrics.json) to client/src/data/, writes pipeline_meta.json with timestamp and warehouse counts." },
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
