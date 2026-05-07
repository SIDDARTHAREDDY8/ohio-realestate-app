# Ohio Real Estate Market Intelligence Platform

> End-to-end data engineering and machine learning project analyzing Ohio's housing market across all 88 counties using real public data from the US Census Bureau, Redfin, and the Federal Reserve Bank of St. Louis.

**[Live Demo →](https://siddarthareddy8.github.io/ohio-realestate-app/)**

---

## What This Is

A production-grade data science portfolio project demonstrating the full data engineering lifecycle:

- **Automated ETL pipeline** ingesting 3 public data sources into a DuckDB analytical warehouse
- **4 trained ML models** — regression, time-series forecasting, clustering, and classification
- **Live data** fetched from Census ACS and BLS APIs directly in the browser (no API key required)
- **Interactive dashboard** with 6 pages of real Ohio housing market analytics
- **GitHub Actions CI/CD** — data refreshes automatically on the 1st of every month

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Data Acquisition | Python · requests · pandas |
| Analytical Warehouse | DuckDB (star schema) · Apache Parquet |
| Feature Engineering | pandas · numpy · scikit-learn |
| ML Models | XGBoost · Facebook Prophet · scikit-learn |
| Live Browser APIs | US Census Bureau ACS · BLS Public API |
| Frontend | React 19 · TypeScript · Vite |
| Visualization | Recharts |
| Styling | Tailwind CSS v4 · IBM Plex Mono |
| CI/CD | GitHub Actions |

---

## Data Sources

| Source | Data | Records |
|--------|------|---------|
| **US Census Bureau ACS 5-Year** | Median home value, rent, income, tenure, vacancy — all 88 Ohio counties, 2019–2023 | 440 county-year records |
| **Redfin Market Tracker** | Monthly sale price, DOM, inventory, sale-to-list ratio | 48,172 county-month records |
| **FRED — St. Louis Fed** | Ohio HPI, mortgage rates, unemployment, employment, CPI, consumer sentiment | 2,934 observations · 21 series |

All data is fetched from public APIs — no paid keys required.

---

## Machine Learning Models

### 1. County Home Value Predictor (XGBoost)
Predicts median home value for any Ohio county given economic and demographic features.

- **R² = 0.9856** · MAE = $3,389 · MAPE = 2.04%
- 5-Fold CV R² = 0.977 ± 0.015
- 21 features including lag values, income, rent, housing stock age
- Top feature: prior-year home value (47% importance)

### 2. Ohio HPI Forecaster (Facebook Prophet)
Time-series forecast of Ohio's FHFA House Price Index, 8 quarters ahead.

- 3 external regressors: 30-yr mortgage rate, unemployment, federal funds rate
- Multiplicative seasonality · 95% confidence interval

### 3. Market Cluster Analysis (K-Means, k=5)
Identifies 5 market archetypes across Ohio's 88 counties.

- Clusters: Affluent Suburban, Stable Mid-Tier, Value Market
- 9 features · StandardScaler · elbow method (k=2–8 tested)

### 4. Affordability Risk Classifier (Random Forest)
Classifies counties into 4 affordability risk tiers.

- Accuracy = 0.89+ · 4 classes: Low Risk / Moderate / High Risk / Severe
- Affordability Index = (5 × median income) / median home value × 100

---

## Project Structure

```
ohio-realestate-app/
├── .github/
│   └── workflows/
│       ├── deploy-pages.yml    # Auto-deploy to GitHub Pages on push
│       ├── refresh-data.yml    # Monthly data refresh (1st of month, 06:00 UTC)
│       └── ci.yml              # TypeScript check + build on every push
├── client/
│   └── src/
│       ├── data/               # Pre-processed JSON (auto-updated by pipeline)
│       ├── hooks/useLiveData.ts # Live Census ACS + BLS API fetcher
│       └── pages/              # 6 dashboard pages
├── pipeline/
│   ├── run_pipeline.py         # Main orchestrator
│   ├── requirements.txt        # Python dependencies
│   ├── scripts/                # Data acquisition (Census, Redfin, FRED)
│   └── src/
│       ├── etl/                # DuckDB ETL pipeline + feature engineering
│       └── models/             # ML model training
└── GITHUB_SETUP.md             # Full setup guide
```

---

## Dashboard Pages

| Page | Description |
|------|-------------|
| **Overview** | Statewide KPIs, HPI trend with ML forecast, county rankings table |
| **County Explorer** | Sortable table of all 88 counties with radar chart profile |
| **Market Trends** | Redfin data — sale price, DOM, sale-to-list ratio, county comparison |
| **ML Insights** | Model comparison, actual vs. predicted scatter, feature importance |
| **Economic Data** | 21 FRED series — HPI, rates, employment, CPI, sentiment |
| **About** | Data provenance, schema docs, ML model specs, pipeline architecture |

---

## Live Data

The top ticker bar fetches **live data on every page load** from two CORS-enabled public APIs:

- **BLS Public API** → Ohio unemployment rate (no key required)
- **US Census Bureau ACS API** → Median home value, rent, income, homeownership (no key required)

FRED metrics (mortgage rate, HPI, listing price, fed funds) update monthly via GitHub Actions.

---

## Automated Data Refresh

GitHub Actions runs the full pipeline on the **1st of every month at 06:00 UTC**:

1. Re-fetches Census ACS, Redfin, and FRED data
2. Rebuilds DuckDB warehouse
3. Re-trains all 4 ML models
4. Exports fresh JSON to `client/src/data/`
5. Commits and pushes updated data → triggers auto-deploy

You can also trigger a manual refresh from **Actions → Monthly Data Refresh → Run workflow**.

---

## Local Setup

```bash
# Clone
git clone https://github.com/SIDDARTHAREDDY8/ohio-realestate-app.git
cd ohio-realestate-app

# Frontend
npm install -g pnpm
pnpm install
pnpm dev  # http://localhost:3000

# Pipeline (optional — data files already included)
pip install -r pipeline/requirements.txt
python pipeline/run_pipeline.py --export-only   # just refresh JSON
python pipeline/run_pipeline.py                 # full re-run
```

---

## Key Findings

- **Delaware County** leads Ohio with a median home value of **$419,500** — 2.3× the state average
- **5-year appreciation** averaged **35.3%** statewide (2019–2023); Union County topped at +50.4%
- **76 of 88 counties** cluster into "Value Market" — Ohio is predominantly affordable vs. coastal markets
- The 2022–2023 Fed rate hike cycle drove 30-yr mortgage rates from 3.1% to 7.8%, directly correlating with a 15% drop in homes sold statewide
- **23 counties** have an affordability index below 80, meaning median income cannot support a conventional mortgage on the median home

---

## License

MIT — data sources are public domain or open data with attribution requirements.

- US Census Bureau: Public domain
- Redfin Market Tracker: [Redfin Data Terms](https://www.redfin.com/about/data-terms)
- FRED: [Federal Reserve Terms of Use](https://fred.stlouisfed.org/docs/api/terms_of_use.html)
