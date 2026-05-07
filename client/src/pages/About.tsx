/* Ohio Blueprint — About & Data Sources
   Project methodology, data sources, architecture, and portfolio information
*/

import { Database, Brain, BarChart3, Code2, GitBranch, ExternalLink } from "lucide-react";

const DATA_SOURCES = [
  {
    name: "US Census Bureau — ACS 5-Year",
    url: "https://www.census.gov/data/developers/data-sets/acs-5year.html",
    description: "American Community Survey 5-Year Estimates for all 88 Ohio counties. Variables include median home value, gross rent, tenure, vacancy, income, and population. Years: 2019–2023.",
    records: "440 county-year records",
    variables: "16 housing variables",
    color: "oklch(0.45 0.18 255)",
  },
  {
    name: "Redfin Market Tracker",
    url: "https://redfin.com/news/data-center/",
    description: "Public housing market data from Redfin's S3 data lake. Monthly metrics for all 88 Ohio counties including median sale price, inventory, days on market, sale-to-list ratio, and price drops.",
    records: "48,172 county-month records",
    variables: "25+ market metrics",
    color: "oklch(0.52 0.17 145)",
  },
  {
    name: "FRED — Federal Reserve Bank of St. Louis",
    url: "https://fred.stlouisfed.org/",
    description: "21 economic time series including Ohio HPI (FHFA), metro-area HPIs for 6 cities, 30-year mortgage rates, federal funds rate, Ohio unemployment, nonfarm employment, consumer sentiment, and CPI.",
    records: "2,934 observations",
    variables: "21 economic series",
    color: "oklch(0.72 0.18 75)",
  },
];

const PIPELINE_STEPS = [
  {
    step: "01",
    title: "Data Acquisition",
    description: "Python scripts fetch data from 3 authoritative sources: Census ACS API (no key required), Redfin public S3 bucket (gzipped TSV), and FRED direct CSV downloads. All scripts are idempotent and can be re-run.",
    tech: ["requests", "pandas", "gzip", "io"],
  },
  {
    step: "02",
    title: "ETL Pipeline",
    description: "OhioRealEstateETL class implements a star schema in DuckDB. Fact tables (census_housing, market_monthly, economic_indicators) join on county_fips and date_key. Derived metrics computed in SQL.",
    tech: ["DuckDB", "pandas", "Star Schema", "SQL"],
  },
  {
    step: "03",
    title: "Feature Engineering",
    description: "46 features per county-year including lag features (1-year, 2-year), rolling averages, derived ratios (price-to-income, gross rent yield, persons per unit), and one-hot encoded region dummies.",
    tech: ["pandas", "numpy", "scikit-learn"],
  },
  {
    step: "04",
    title: "ML Model Training",
    description: "4 models: XGBoost home value predictor (R²=0.986), Prophet HPI time-series forecaster with 3 economic regressors, K-Means market clustering (k=5), and Random Forest affordability classifier.",
    tech: ["XGBoost", "Prophet", "scikit-learn", "K-Means"],
  },
  {
    step: "05",
    title: "Data Export & API",
    description: "Processed data exported to JSON for frontend consumption. DuckDB warehouse serves as the analytical backend. All model artifacts serialized with pickle for reproducibility.",
    tech: ["DuckDB", "JSON", "pickle", "parquet"],
  },
  {
    step: "06",
    title: "Web Application",
    description: "React 19 + TypeScript frontend with Recharts for interactive visualizations. Tailwind CSS v4 with custom Ohio Blueprint design system. Deployed on Manus infrastructure.",
    tech: ["React 19", "TypeScript", "Recharts", "Tailwind v4"],
  },
];

const ML_MODELS = [
  {
    name: "County Home Value Predictor",
    type: "XGBoost Regressor",
    target: "Median home value by county-year",
    r2: "0.9856",
    mape: "2.04%",
    features: "21 features",
    cv: "5-fold CV R²: 0.977 ± 0.015",
  },
  {
    name: "Ohio HPI Forecaster",
    type: "Facebook Prophet",
    target: "Ohio FHFA House Price Index",
    r2: "Time-series model",
    mape: "8-quarter forecast",
    features: "3 regressors",
    cv: "Train/test split: 36/8 quarters",
  },
  {
    name: "Market Cluster Analysis",
    type: "K-Means (k=5)",
    target: "Market archetype classification",
    r2: "Inertia: 369.3",
    mape: "5 clusters",
    features: "9 cluster features",
    cv: "Elbow method: k=2–8 tested",
  },
  {
    name: "Affordability Risk Classifier",
    type: "Random Forest Classifier",
    target: "4-class affordability risk",
    r2: "Accuracy: 0.89+",
    mape: "4 risk classes",
    features: "11 features",
    cv: "Stratified train/test split",
  },
];

export default function About() {
  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Hero */}
      <div
        className="rounded-xl overflow-hidden relative"
        style={{ minHeight: 180 }}
      >
        <img
          src="https://d2xsxph8kpxj0f.cloudfront.net/310519663613189187/PkeVEBVLWZFZJFDuPiXFCT/ohio-market-banner-UwdPcnnwbK7xttfJrNSTuL.webp"
          alt="Ohio Market Intelligence"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, oklch(0.13 0.025 255 / 0.9) 0%, oklch(0.13 0.025 255 / 0.6) 100%)" }} />
        <div className="relative z-10 p-8">
          <h1 className="text-2xl font-bold text-white mb-2">Ohio Real Estate Market Intelligence Platform</h1>
          <p className="text-sm max-w-2xl" style={{ color: "oklch(0.78 0.02 240)" }}>
            A production-grade data engineering and machine learning project built with real public data.
            Demonstrates end-to-end data pipeline design, analytical warehouse architecture, ML model development,
            and interactive data visualization — all on live Ohio real estate data.
          </p>
          <div className="flex flex-wrap gap-3 mt-4">
            {["Python", "DuckDB", "XGBoost", "Prophet", "React 19", "Recharts", "Tailwind v4"].map(t => (
              <span key={t} className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ backgroundColor: "oklch(1 0 0 / 0.15)", color: "white" }}>
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Data Sources */}
      <div>
        <h2 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
          <Database className="w-4 h-4" style={{ color: "oklch(0.45 0.18 255)" }} />
          Data Sources
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {DATA_SOURCES.map(src => (
            <div key={src.name} className="chart-container">
              <div className="flex items-start justify-between mb-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: src.color + "20" }}>
                  <Database className="w-4 h-4" style={{ color: src.color }} />
                </div>
                <a href={src.url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
              <h3 className="text-sm font-semibold text-foreground mb-2">{src.name}</h3>
              <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{src.description}</p>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Records</span>
                  <span className="data-value font-semibold" style={{ color: src.color }}>{src.records}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Variables</span>
                  <span className="data-value font-semibold" style={{ color: src.color }}>{src.variables}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ETL Pipeline */}
      <div>
        <h2 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
          <GitBranch className="w-4 h-4" style={{ color: "oklch(0.45 0.18 255)" }} />
          Data Engineering Pipeline
        </h2>
        <div className="space-y-3">
          {PIPELINE_STEPS.map((step, i) => (
            <div key={step.step} className="chart-container flex gap-4">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 data-value text-sm font-bold"
                style={{ backgroundColor: "oklch(0.45 0.18 255)", color: "white" }}
              >
                {step.step}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-foreground mb-1">{step.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed mb-2">{step.description}</p>
                <div className="flex flex-wrap gap-1.5">
                  {step.tech.map(t => (
                    <span key={t} className="text-xs px-2 py-0.5 rounded font-medium" style={{ backgroundColor: "oklch(0.94 0.015 255)", color: "oklch(0.35 0.15 255)" }}>
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ML Models */}
      <div>
        <h2 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
          <Brain className="w-4 h-4" style={{ color: "oklch(0.45 0.18 255)" }} />
          Machine Learning Models
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {ML_MODELS.map(m => (
            <div key={m.name} className="chart-container">
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-sm font-semibold text-foreground">{m.name}</h3>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: "oklch(0.94 0.015 255)", color: "oklch(0.35 0.15 255)" }}>
                  {m.type}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">{m.target}</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Performance", val: m.r2 },
                  { label: "Accuracy", val: m.mape },
                  { label: "Features", val: m.features },
                  { label: "Validation", val: m.cv },
                ].map(row => (
                  <div key={row.label} className="rounded p-2" style={{ backgroundColor: "oklch(0.96 0.005 240)" }}>
                    <div className="text-xs text-muted-foreground">{row.label}</div>
                    <div className="text-xs font-semibold text-foreground mt-0.5 data-value">{row.val}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Architecture */}
      <div className="chart-container">
        <h2 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
          <Code2 className="w-4 h-4" style={{ color: "oklch(0.45 0.18 255)" }} />
          Technical Architecture
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-sm">
          <div>
            <h3 className="font-semibold text-foreground mb-2">Data Layer</h3>
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li>• DuckDB analytical warehouse (star schema)</li>
              <li>• Parquet files for efficient storage</li>
              <li>• JSON exports for frontend consumption</li>
              <li>• Idempotent ETL pipeline scripts</li>
              <li>• Automated data quality checks</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-2">ML Layer</h3>
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li>• scikit-learn pipelines with imputation</li>
              <li>• XGBoost with early stopping</li>
              <li>• Facebook Prophet with regressors</li>
              <li>• K-Means with elbow method selection</li>
              <li>• Pickle serialization for model artifacts</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-2">Frontend Layer</h3>
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li>• React 19 + TypeScript + Vite</li>
              <li>• Recharts for interactive visualizations</li>
              <li>• Tailwind CSS v4 design system</li>
              <li>• Wouter for client-side routing</li>
              <li>• shadcn/ui component library</li>
            </ul>
          </div>
        </div>
        <div className="mt-4 p-3 rounded-lg text-xs text-muted-foreground" style={{ backgroundColor: "oklch(0.96 0.005 240)" }}>
          <strong className="text-foreground">Project Structure:</strong> ohio-realestate/ ├── scripts/ (data acquisition) ├── src/etl/ (pipeline + features) ├── src/models/ (ML training) ├── data/raw/ (source data) ├── data/processed/ (features + predictions) ├── data/warehouse/ (DuckDB + model artifacts) └── ohio-realestate-app/ (React frontend)
        </div>
      </div>
    </div>
  );
}
