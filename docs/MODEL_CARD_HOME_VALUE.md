# Model Card: County Home Value Predictor

## Model Details
- **Developer:** SIDDARTHAREDDY8 Data Science Team
- **Model Date:** July 2026
- **Model Type:** Gradient Boosted Decision Trees (XGBoost)
- **Version:** 1.0.0
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
- **Mean Absolute Error (MAE):** ~$3,389
- **Root Mean Squared Error (RMSE):** ~$4,500
- **R² Score:** 0.9856
- **Mean Absolute Percentage Error (MAPE):** 2.04%
- **5-Fold Cross-Validation R²:** 0.977 ± 0.015

## Training Data
- **Source:** US Census Bureau ACS 5-Year Estimates (2019-2023).
- **Scope:** All 88 Ohio counties.
- **Pre-processing:** Median imputation for missing values, standard scaling for linear benchmarks, and regional one-hot encoding.

## Quantitative Analyses
- **Feature Importance:** The most significant predictor is the prior-year median home value (approx. 47% importance), followed by median household income and housing stock age.
- **Error Analysis:** The model shows higher variance in rapidly urbanizing counties compared to stable rural counties.

## Ethical Considerations
- **Data Bias:** The model relies on Census data, which may under-represent certain marginalized populations.
- **Socioeconomic Impact:** Predictions could inadvertently influence gentrification patterns if used without considering broader community impacts.

## Caveats and Recommendations
- The model's performance is highly dependent on the accuracy and timeliness of Census Bureau data releases.
- Users should cross-reference predictions with real-time market trackers (e.g., Redfin) for short-term volatility.
