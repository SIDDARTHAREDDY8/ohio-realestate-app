# Methodology & Data Governance Framework

## Project Objective
The Ohio Real Estate Market Intelligence Platform is designed to provide a centralized, data-driven overview of the residential real estate landscape in Ohio. By integrating disparate public data sources, the platform enables stakeholders to identify market trends, assess affordability risks, and forecast future economic indicators with high precision.

## Data Provenance & Acquisition
The platform utilizes a multi-source ingestion strategy to ensure a comprehensive view of the market.

| Source | Data Type | Update Frequency | Primary Use |
| :--- | :--- | :--- | :--- |
| **US Census Bureau** | Demographic & Structural | Annual (ACS 5-Year) | Baseline valuation & risk modeling |
| **Redfin** | Market Transactional | Monthly | Real-time liquidity & price tracking |
| **FRED (St. Louis Fed)** | Macroeconomic | Monthly/Weekly | Time-series forecasting & HPI analysis |

## Analytical Pipeline Architecture
The pipeline is orchestrated using Python and follows a modular ETL (Extract, Transform, Load) pattern.

1.  **Ingestion:** Raw data is fetched via REST APIs and stored as Parquet files for high-performance retrieval.
2.  **Warehousing:** Data is loaded into a DuckDB analytical warehouse, utilizing a star schema for efficient querying.
3.  **Feature Engineering:** Includes the creation of lagged variables, rolling averages, and regional archetypes to capture temporal and spatial dependencies.
4.  **Modeling:** Four distinct ML architectures are employed to handle regression, forecasting, clustering, and classification tasks.
5.  **Deployment:** Automated GitHub Actions handle the end-to-end refresh of data and model weights on the 1st of every month.

## Model Governance & Validation
To ensure corporate-grade reliability, all models undergo rigorous validation:

*   **Cross-Validation:** K-Fold cross-validation (k=5) is used to assess model stability and prevent overfitting.
*   **Backtesting:** The HPI Forecaster is backtested against historical 8-quarter windows to verify prediction accuracy.
*   **Drift Monitoring:** Pipeline metadata tracks record counts and distribution shifts to alert on potential data quality issues.

## Data Ethics & Privacy
This project strictly adheres to public data usage terms. No Personally Identifiable Information (PII) is collected or processed. The platform promotes transparency by citing all data sources and providing a comprehensive methodology for every analytical insight presented.
