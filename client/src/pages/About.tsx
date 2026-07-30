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

const REFRESH_DATE = meta.last_refresh
  ? new Date(meta.last_refresh).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  : "—";

const HERO_STATS = [
  { label: "Ohio Counties", value: "88" },
  { label: "Data Sources", value: "4" },
  { label: "ML Models", value: "4" },
  { label: "Warehouse Records", value: fmtNum((meta.census_rows ?? 0) + (meta.market_rows ?? 0) + (meta.economic_rows ?? 0)) },
  { label: "Last Refresh", value: REFRESH_DATE },
];

export default function About() {
  return (
    <div className="p-6 space-y-6 max-w-6xl">

      {/* Hero */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-3 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">About &amp; Data</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            How this platform works — data provenance, warehouse architecture, model methodology,
            and the automation that keeps everything fresh.
          </p>
        </div>
        <span className="badge-cached">Auto-refreshed monthly · GitHub Actions</span>
      </div>

      {/* Stat band */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {HERO_STATS.map(s => (
          <div key={s.label} className="panel p-4">
            <div className="data-value text-xl font-bold" style={{ color: "var(--primary)" }}>{s.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Overview */}
      <div className="panel p-5">
        <div className="text-sm" style={{ lineHeight: 1.75 }}>
          <span className="font-semibold">Ohio Market IQ</span> is an end-to-end market intelligence
          platform: an automated ETL pipeline ingests public housing and economic data into a DuckDB
          analytical warehouse, four machine-learning models are retrained on every refresh, and this
          dashboard serves the results alongside live Census and BLS metrics. Every number shown in the
          product is traceable to a public source and reproducible from the pipeline code.
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          {["Python 3.11", "DuckDB", "XGBoost", "Prophet", "scikit-learn", "React 19", "TypeScript", "Recharts", "GitHub Actions"].map(t => (
            <span key={t} className="text-xs px-2.5 py-1 rounded-full font-medium"
              style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}>
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* Data sources */}
      <div>
        <h2 className="text-base font-bold mb-3">Data Sources</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {DATA_SOURCES.map(src => (
            <div key={src.name} className="panel p-4 flex flex-col">
              <div className="flex items-start justify-between mb-2">
                <div className="text-sm font-semibold pr-2">{src.name}</div>
                <a href={src.url} target="_blank" rel="noopener noreferrer"
                   className="text-muted-foreground hover:text-foreground flex-shrink-0 mt-0.5">
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-3">
                <span className="badge-cached">{src.records}</span>
                <span className="badge-cached">{src.coverage.split("·")[1]?.trim() ?? src.coverage}</span>
              </div>
              <div className="text-xs text-muted-foreground mb-3" style={{ lineHeight: 1.6 }}>
                Coverage: {src.coverage}. {src.license}.
              </div>
              <div className="text-xs mb-3">
                <div className="font-semibold text-muted-foreground mb-1">Variables used</div>
                <div className="text-muted-foreground" style={{ lineHeight: 1.7 }}>{src.tables.join(" · ")}</div>
              </div>
              <div className="text-xs mt-auto pt-3" style={{ borderTop: "1px solid var(--border)" }}>
                <div className="font-semibold mb-1" style={{ color: "var(--destructive)" }}>Known limitations</div>
                <div className="text-muted-foreground" style={{ lineHeight: 1.6 }}>{src.limitations}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Warehouse schema */}
      <div>
        <h2 className="text-base font-bold mb-3">Analytical Warehouse</h2>
        <div className="panel">
        <SectionHeader title="DuckDB Star Schema" source="pipeline/src/etl/pipeline.py" />
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
        <div className="px-4 py-2.5 source-tag" style={{ borderTop: "1px solid var(--border)" }}>
          Warehouse file: pipeline/data/warehouse/ohio_realestate.duckdb · Schema: ohio_re · Engine: DuckDB (columnar, in-process)
        </div>
        </div>
      </div>

      {/* ML models */}
      <div>
        <h2 className="text-base font-bold mb-3">Machine Learning Models</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {ML_MODELS.map(m => (
            <div key={m.name} className="panel p-4">
              <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                <div className="text-sm font-semibold">{m.name}</div>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}>
                  {m.algorithm}
                </span>
              </div>
              <div className="data-value text-sm font-semibold mb-3" style={{ color: "oklch(0.50 0.15 150)" }}>
                {m.metrics}
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex gap-2">
                  <span className="text-muted-foreground w-20 flex-shrink-0 font-medium">Target</span>
                  <span>{m.target}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-muted-foreground w-20 flex-shrink-0 font-medium">Validation</span>
                  <span>{m.train_test}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-muted-foreground w-20 flex-shrink-0 font-medium">Features</span>
                  <span>{m.features}</span>
                </div>
              </div>
              <div className="text-xs text-muted-foreground mt-3 pt-3" style={{ borderTop: "1px solid var(--border)", lineHeight: 1.6 }}>
                {m.notes}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pipeline timeline */}
      <div>
        <h2 className="text-base font-bold mb-3">Data Pipeline</h2>
        <div className="panel p-5">
          <div className="space-y-0">
            {PIPELINE_STEPS.map((s, i) => (
              <div key={s.step} className="flex gap-4">
                {/* Timeline marker */}
                <div className="flex flex-col items-center">
                  <div className="flex items-center justify-center flex-shrink-0"
                    style={{
                      width: 28, height: 28, borderRadius: "50%",
                      background: "var(--accent)", color: "var(--accent-foreground)",
                      fontSize: 12, fontWeight: 700,
                    }}>
                    {i + 1}
                  </div>
                  {i < PIPELINE_STEPS.length - 1 && (
                    <div style={{ width: 2, flex: 1, background: "var(--border)", margin: "4px 0" }} />
                  )}
                </div>
                <div className={i < PIPELINE_STEPS.length - 1 ? "pb-5" : ""}>
                  <code className="text-xs font-semibold" style={{ color: "var(--primary)" }}>{s.name}</code>
                  <div className="text-xs text-muted-foreground mt-1" style={{ lineHeight: 1.6 }}>{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="text-xs text-muted-foreground mt-4 pt-4 flex flex-wrap gap-x-6 gap-y-1"
            style={{ borderTop: "1px solid var(--border)" }}>
            <span><span className="font-semibold text-foreground">Schedule:</span> 1st of every month, 06:00 UTC</span>
            <span><span className="font-semibold text-foreground">Automation:</span> GitHub Actions → commit → auto-deploy</span>
            <span><span className="font-semibold text-foreground">Runtime:</span> ubuntu-latest, ~10 min</span>
          </div>
        </div>
      </div>

      {/* Resources */}
      <div>
        <h2 className="text-base font-bold mb-3">Resources</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: "GitHub Repository", desc: "Full source: pipeline, models, dashboard, workflows", href: "https://github.com/SIDDARTHAREDDY8/ohio-realestate-app" },
            { label: "Methodology & Governance", desc: "Data provenance, validation protocol, ethics", href: "https://github.com/SIDDARTHAREDDY8/ohio-realestate-app/blob/main/docs/METHODOLOGY.md" },
            { label: "Model Card: Home Value", desc: "Intended use, metrics, caveats for the flagship model", href: "https://github.com/SIDDARTHAREDDY8/ohio-realestate-app/blob/main/docs/MODEL_CARD_HOME_VALUE.md" },
          ].map(l => (
            <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer"
               className="panel p-4 hover:shadow-md transition-shadow"
               style={{ textDecoration: "none", color: "inherit" }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold">{l.label}</span>
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <div className="text-xs text-muted-foreground" style={{ lineHeight: 1.6 }}>{l.desc}</div>
            </a>
          ))}
        </div>
      </div>

    </div>
  );
}
