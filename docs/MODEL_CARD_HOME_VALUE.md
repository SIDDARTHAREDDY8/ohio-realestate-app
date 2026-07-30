# Model Card: County Home Value Predictor

## Model Details
- **Developer:** SIDDARTHAREDDY8 Data Science Team
- **Model Date:** July 2026
- **Model Type:** Gradient Boosted Decision Trees (best of XGBoost / GradientBoosting / RandomForest, selected on a held-out year — currently Gradient Boosting)
- **Version:** 1.1.0
- **License:** MIT

## Intended Use
- **Primary intended uses:** This model is intended to predict the median home value for Ohio counties based on historical economic and demographic indicators. It serves as a decision-support tool for real estate investment analysis and urban planning.
- **Primary intended users:** Real estate analysts, urban planners, and policy researchers.
- **Out-of-scope use cases:** This model should not be used for individual property appraisal or as the sole basis for high-stakes financial decisions.

## Factors
- **Demographic Factors:** Population, homeownership rate, vacancy rate, renter rate.
- **Economic Factors:** Median household income, median gross rent, price-to-income ratio.
- **Housing Stock Factors:** Median year structure built, median rooms, housing stock age.
- **Temporal Factors:** Year, lagged home values (1-year and 2-year lags).

## Metrics
All metrics are computed on a **temporal holdout** — the model is trained on
2019–2022 and evaluated on 2023, which it never sees during training. This
matters because the feature set includes lagged values of the target; a random
train/test split would leak adjacent years of the same county and inflate
scores. Current values (auto-refreshed in `client/src/data/model_metrics.json`
on every training run):

- **Mean Absolute Error (MAE):** ~$3,902
- **R² Score (2023 holdout):** 0.9864
- **Mean Absolute Percentage Error (MAPE):** ~2.0%
- **Expanding-Window CV R² (2021–2023):** 0.959 ± 0.023

## Training Data
- **Source:** US Census Bureau ACS 5-Year Estimates (2019-2023).
- **Scope:** All 88 Ohio counties.
- **Pre-processing:** Median imputation for missing values, standard scaling for linear benchmarks, and regional one-hot encoding.
- **Validation protocol:** Temporal holdout (train < 2023, test = 2023) plus expanding-window cross-validation — no shuffled splits, so lagged-target features cannot leak.

## Quantitative Analyses
- **Feature Importance:** The most significant predictor is the prior-year median home value (approx. 47% importance), followed by median household income and housing stock age.
- **Error Analysis:** The model shows higher variance in rapidly urbanizing counties compared to stable rural counties.

## Ethical Considerations
- **Data Bias:** The model relies on Census data, which may under-represent certain marginalized populations.
- **Socioeconomic Impact:** Predictions could inadvertently influence gentrification patterns if used without considering broader community impacts.

## Caveats and Recommendations
- The model's performance is highly dependent on the accuracy and timeliness of Census Bureau data releases.
- Users should cross-reference predictions with real-time market trackers (e.g., Redfin) for short-term volatility.
