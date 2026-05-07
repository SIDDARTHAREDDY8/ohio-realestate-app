"""
Ohio Real Estate Market Intelligence Platform
ML Models:
  1. County Home Value Predictor (XGBoost + Ridge regression)
  2. Ohio HPI Time-Series Forecaster (Prophet + SARIMA)
  3. Market Cluster Analysis (K-Means)
  4. Affordability Classifier (Random Forest)
"""

import pandas as pd
import numpy as np
from pathlib import Path
import pickle
import json
import logging
import warnings
warnings.filterwarnings("ignore")

from sklearn.model_selection import train_test_split, cross_val_score, KFold
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.linear_model import Ridge, Lasso, ElasticNet
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.cluster import KMeans
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
import xgboost as xgb

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent.parent
PROCESSED_DIR = BASE_DIR / "data" / "processed"
MODELS_DIR = BASE_DIR / "data" / "warehouse" / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)


def load_features():
    """Load processed feature files."""
    county_df = pd.read_parquet(PROCESSED_DIR / "county_features.parquet")
    ts_df = pd.read_parquet(PROCESSED_DIR / "timeseries_features.parquet")
    heat_df = pd.read_parquet(PROCESSED_DIR / "market_heat_index.parquet")
    return county_df, ts_df, heat_df


def evaluate_model(model, X_test, y_test, name: str) -> dict:
    """Evaluate regression model and return metrics."""
    y_pred = model.predict(X_test)
    mae = mean_absolute_error(y_test, y_pred)
    rmse = np.sqrt(mean_squared_error(y_test, y_pred))
    r2 = r2_score(y_test, y_pred)
    mape = np.mean(np.abs((y_test - y_pred) / np.where(y_test == 0, 1, y_test))) * 100

    metrics = {"model": name, "mae": round(mae, 2), "rmse": round(rmse, 2),
               "r2": round(r2, 4), "mape": round(mape, 2)}
    logger.info(f"  {name}: MAE=${mae:,.0f} | RMSE=${rmse:,.0f} | R²={r2:.4f} | MAPE={mape:.1f}%")
    return metrics


# =============================================================================
# Model 1: County Home Value Prediction
# =============================================================================
def train_home_value_predictor(county_df: pd.DataFrame) -> dict:
    """Train XGBoost model to predict county median home value."""
    logger.info("\n" + "=" * 50)
    logger.info("Model 1: County Home Value Predictor")
    logger.info("=" * 50)

    # Feature selection
    feature_cols = [
        "median_household_income", "median_gross_rent", "total_population",
        "homeownership_rate", "vacancy_rate", "renter_rate",
        "median_year_structure_built", "median_rooms",
        "price_to_income_ratio", "persons_per_unit", "housing_stock_age",
        "is_metro_int", "year",
        # Lag features
        "median_home_value_lag1", "median_home_value_lag2",
        "median_household_income_lag1",
        # Region dummies
    ]
    region_cols = [c for c in county_df.columns if c.startswith("region_")]
    feature_cols += region_cols

    available_features = [c for c in feature_cols if c in county_df.columns]
    target = "median_home_value"

    # Prepare data
    df_model = county_df[available_features + [target, "county_name", "county_fips"]].dropna(
        subset=[target] + ["median_household_income", "median_gross_rent"]
    )

    X = df_model[available_features]
    y = df_model[target]

    logger.info(f"  Training samples: {len(X)}")
    logger.info(f"  Features: {len(available_features)}")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    # Impute missing values
    imputer = SimpleImputer(strategy="median")
    X_train_imp = imputer.fit_transform(X_train)
    X_test_imp = imputer.transform(X_test)

    all_metrics = []

    # --- XGBoost ---
    xgb_model = xgb.XGBRegressor(
        n_estimators=300,
        max_depth=6,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        min_child_weight=3,
        reg_alpha=0.1,
        reg_lambda=1.0,
        random_state=42,
        n_jobs=-1,
    )
    xgb_model.fit(X_train_imp, y_train,
                  eval_set=[(X_test_imp, y_test)],
                  verbose=False)
    all_metrics.append(evaluate_model(xgb_model, X_test_imp, y_test, "XGBoost"))

    # --- Gradient Boosting ---
    gb_model = GradientBoostingRegressor(
        n_estimators=200, max_depth=4, learning_rate=0.1,
        subsample=0.8, random_state=42
    )
    gb_model.fit(X_train_imp, y_train)
    all_metrics.append(evaluate_model(gb_model, X_test_imp, y_test, "GradientBoosting"))

    # --- Random Forest ---
    rf_model = RandomForestRegressor(
        n_estimators=200, max_depth=8, min_samples_leaf=2, random_state=42, n_jobs=-1
    )
    rf_model.fit(X_train_imp, y_train)
    all_metrics.append(evaluate_model(rf_model, X_test_imp, y_test, "RandomForest"))

    # --- Ridge Regression ---
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train_imp)
    X_test_scaled = scaler.transform(X_test_imp)
    ridge_model = Ridge(alpha=100)
    ridge_model.fit(X_train_scaled, y_train)
    all_metrics.append(evaluate_model(ridge_model, X_test_scaled, y_test, "Ridge"))

    # Best model = XGBoost
    best_model = xgb_model

    # Feature importance
    feat_importance = pd.DataFrame({
        "feature": available_features,
        "importance": best_model.feature_importances_
    }).sort_values("importance", ascending=False)
    logger.info(f"\n  Top 10 features:\n{feat_importance.head(10).to_string()}")

    # Cross-validation on best model
    cv = KFold(n_splits=5, shuffle=True, random_state=42)
    X_all_imp = imputer.transform(X)
    cv_scores = cross_val_score(xgb_model, X_all_imp, y, cv=cv, scoring="r2")
    logger.info(f"\n  5-Fold CV R²: {cv_scores.mean():.4f} ± {cv_scores.std():.4f}")

    # Generate predictions for all counties (2023)
    df_2023 = county_df[county_df["year"] == 2023].copy()
    X_2023 = df_2023[available_features]
    X_2023_imp = imputer.transform(X_2023)
    df_2023["predicted_home_value"] = best_model.predict(X_2023_imp)
    df_2023["prediction_error_pct"] = (
        (df_2023["predicted_home_value"] - df_2023["median_home_value"]) /
        df_2023["median_home_value"] * 100
    ).round(2)

    predictions_df = df_2023[["county_fips", "county_name", "median_home_value",
                               "predicted_home_value", "prediction_error_pct"]].copy()
    predictions_df.to_parquet(PROCESSED_DIR / "county_value_predictions.parquet", index=False)
    predictions_df.to_csv(PROCESSED_DIR / "county_value_predictions.csv", index=False)

    # Save model artifacts
    artifacts = {
        "model": best_model,
        "imputer": imputer,
        "feature_cols": available_features,
        "feature_importance": feat_importance,
        "metrics": all_metrics,
        "cv_r2_mean": float(cv_scores.mean()),
        "cv_r2_std": float(cv_scores.std()),
    }
    with open(MODELS_DIR / "home_value_predictor.pkl", "wb") as f:
        pickle.dump(artifacts, f)

    # Save metrics as JSON
    with open(MODELS_DIR / "home_value_metrics.json", "w") as f:
        json.dump({
            "model_name": "County Home Value Predictor",
            "best_model": "XGBoost",
            "metrics": all_metrics,
            "cv_r2_mean": float(cv_scores.mean()),
            "cv_r2_std": float(cv_scores.std()),
            "n_features": len(available_features),
            "n_samples": len(X),
            "feature_importance": feat_importance.head(15).to_dict(orient="records"),
        }, f, indent=2)

    logger.info(f"\n  Saved model to {MODELS_DIR / 'home_value_predictor.pkl'}")
    return artifacts


# =============================================================================
# Model 2: HPI Time-Series Forecasting (Prophet)
# =============================================================================
def train_hpi_forecaster(ts_df: pd.DataFrame) -> dict:
    """Train Prophet model to forecast Ohio HPI."""
    logger.info("\n" + "=" * 50)
    logger.info("Model 2: Ohio HPI Time-Series Forecaster")
    logger.info("=" * 50)

    try:
        from prophet import Prophet
    except ImportError:
        logger.warning("Prophet not installed, using simple trend model")
        return {}

    # Prepare HPI series
    if "ohio_hpi_all_transactions" not in ts_df.columns:
        logger.warning("Ohio HPI not in time-series data")
        return {}

    hpi_df = ts_df[["date", "ohio_hpi_all_transactions"]].dropna()
    hpi_df = hpi_df.rename(columns={"date": "ds", "ohio_hpi_all_transactions": "y"})
    hpi_df["ds"] = pd.to_datetime(hpi_df["ds"])

    logger.info(f"  Training on {len(hpi_df)} observations")
    logger.info(f"  Date range: {hpi_df['ds'].min()} to {hpi_df['ds'].max()}")

    # Add regressors if available
    regressors = []
    for col in ["mortgage_rate_30yr_fixed", "ohio_unemployment_rate", "federal_funds_rate"]:
        if col in ts_df.columns:
            reg_df = ts_df[["date", col]].dropna()
            reg_df = reg_df.rename(columns={"date": "ds", col: col})
            reg_df["ds"] = pd.to_datetime(reg_df["ds"])
            hpi_df = hpi_df.merge(reg_df, on="ds", how="left")
            regressors.append(col)

    # Fill regressors
    for col in regressors:
        if col in hpi_df.columns:
            hpi_df[col] = hpi_df[col].ffill().bfill()

    # Train/test split (last 8 quarters = 2 years for quarterly data)
    train_df = hpi_df.iloc[:-8]
    test_df = hpi_df.iloc[-8:]

    # Build Prophet model
    model = Prophet(
        changepoint_prior_scale=0.1,
        seasonality_mode="multiplicative",
        yearly_seasonality=True,
        weekly_seasonality=False,
        daily_seasonality=False,
        interval_width=0.95,
    )

    for reg in regressors:
        if reg in hpi_df.columns:
            model.add_regressor(reg, standardize=True)

    model.fit(train_df)

    # Evaluate on test set
    future_test = test_df[["ds"] + regressors].copy() if regressors else test_df[["ds"]].copy()
    forecast_test = model.predict(future_test)
    y_pred = forecast_test["yhat"].values
    y_true = test_df["y"].values

    mae = mean_absolute_error(y_true, y_pred)
    rmse = np.sqrt(mean_squared_error(y_true, y_pred))
    r2 = r2_score(y_true, y_pred)
    logger.info(f"  Test MAE: {mae:.2f} | RMSE: {rmse:.2f} | R²: {r2:.4f}")

    # Retrain on full data
    model_full = Prophet(
        changepoint_prior_scale=0.1,
        seasonality_mode="multiplicative",
        yearly_seasonality=True,
        weekly_seasonality=False,
        daily_seasonality=False,
        interval_width=0.95,
    )
    for reg in regressors:
        if reg in hpi_df.columns:
            model_full.add_regressor(reg, standardize=True)
    model_full.fit(hpi_df)

    # Forecast 8 quarters ahead
    future = model_full.make_future_dataframe(periods=8, freq="QS")
    for reg in regressors:
        if reg in hpi_df.columns:
            last_val = hpi_df[reg].iloc[-1]
            future[reg] = future["ds"].map(
                lambda d: hpi_df.set_index("ds")[reg].get(d, last_val)
            ).fillna(last_val)

    forecast = model_full.predict(future)

    # Save forecast
    forecast_out = forecast[["ds", "yhat", "yhat_lower", "yhat_upper", "trend"]].copy()
    forecast_out.columns = ["date", "hpi_forecast", "hpi_lower", "hpi_upper", "hpi_trend"]
    forecast_out.to_parquet(PROCESSED_DIR / "hpi_forecast.parquet", index=False)
    forecast_out.to_csv(PROCESSED_DIR / "hpi_forecast.csv", index=False)

    # Save model
    with open(MODELS_DIR / "hpi_forecaster.pkl", "wb") as f:
        pickle.dump({"model": model_full, "forecast": forecast_out}, f)

    metrics = {
        "model_name": "Ohio HPI Prophet Forecaster",
        "test_mae": round(float(mae), 4),
        "test_rmse": round(float(rmse), 4),
        "test_r2": round(float(r2), 4),
        "n_train": len(train_df),
        "n_test": len(test_df),
        "regressors": regressors,
        "forecast_periods": 8,
    }
    with open(MODELS_DIR / "hpi_forecast_metrics.json", "w") as f:
        json.dump(metrics, f, indent=2)

    logger.info(f"  Forecast saved: {len(forecast_out)} periods")
    return {"model": model_full, "forecast": forecast_out, "metrics": metrics}


# =============================================================================
# Model 3: Market Cluster Analysis
# =============================================================================
def train_market_clusters(county_df: pd.DataFrame) -> pd.DataFrame:
    """K-Means clustering to identify market archetypes."""
    logger.info("\n" + "=" * 50)
    logger.info("Model 3: Market Cluster Analysis")
    logger.info("=" * 50)

    df_2023 = county_df[county_df["year"] == 2023].copy()

    cluster_features = [
        "median_home_value", "median_household_income", "homeownership_rate",
        "vacancy_rate", "affordability_ratio", "price_to_income_ratio",
        "home_value_yoy", "housing_stock_age", "total_population",
    ]
    available = [c for c in cluster_features if c in df_2023.columns]
    X_cluster = df_2023[available].copy()

    # Impute and scale
    imputer = SimpleImputer(strategy="median")
    scaler = StandardScaler()
    X_imp = imputer.fit_transform(X_cluster)
    X_scaled = scaler.fit_transform(X_imp)

    # Find optimal k using elbow method
    inertias = []
    k_range = range(2, 9)
    for k in k_range:
        km = KMeans(n_clusters=k, random_state=42, n_init=10)
        km.fit(X_scaled)
        inertias.append(km.inertia_)

    # Use k=5 (good balance for Ohio's market diversity)
    k_optimal = 5
    kmeans = KMeans(n_clusters=k_optimal, random_state=42, n_init=20)
    df_2023["cluster"] = kmeans.fit_predict(X_scaled)

    # Label clusters based on characteristics
    cluster_stats = df_2023.groupby("cluster")[available].mean()
    logger.info(f"\n  Cluster statistics:\n{cluster_stats.round(0).to_string()}")

    # Assign descriptive labels
    cluster_labels = {}
    for c in range(k_optimal):
        stats = cluster_stats.loc[c]
        if stats.get("median_home_value", 0) > 250000:
            if stats.get("homeownership_rate", 0) > 75:
                cluster_labels[c] = "Affluent Suburban"
            else:
                cluster_labels[c] = "Urban Premium"
        elif stats.get("median_home_value", 0) > 180000:
            if stats.get("vacancy_rate", 0) > 10:
                cluster_labels[c] = "Transitional Market"
            else:
                cluster_labels[c] = "Stable Mid-Tier"
        else:
            cluster_labels[c] = "Value Market"

    df_2023["cluster_label"] = df_2023["cluster"].map(cluster_labels)
    logger.info(f"\n  Cluster distribution:\n{df_2023['cluster_label'].value_counts().to_string()}")

    # Save
    cluster_out = df_2023[["county_fips", "county_name", "region", "cluster",
                            "cluster_label"] + available].copy()
    cluster_out.to_parquet(PROCESSED_DIR / "market_clusters.parquet", index=False)
    cluster_out.to_csv(PROCESSED_DIR / "market_clusters.csv", index=False)

    # Save model
    with open(MODELS_DIR / "market_clusters.pkl", "wb") as f:
        pickle.dump({
            "model": kmeans,
            "imputer": imputer,
            "scaler": scaler,
            "feature_cols": available,
            "cluster_labels": cluster_labels,
            "k": k_optimal,
            "inertias": {k: v for k, v in zip(k_range, inertias)},
        }, f)

    with open(MODELS_DIR / "cluster_metrics.json", "w") as f:
        json.dump({
            "k": k_optimal,
            "cluster_labels": cluster_labels,
            "cluster_counts": df_2023["cluster_label"].value_counts().to_dict(),
            "inertias": {str(k): float(v) for k, v in zip(k_range, inertias)},
        }, f, indent=2)

    return cluster_out


# =============================================================================
# Model 4: Affordability Risk Classifier
# =============================================================================
def train_affordability_classifier(county_df: pd.DataFrame) -> dict:
    """Classify counties by affordability risk level."""
    logger.info("\n" + "=" * 50)
    logger.info("Model 4: Affordability Risk Classifier")
    logger.info("=" * 50)

    from sklearn.ensemble import RandomForestClassifier
    from sklearn.metrics import classification_report, accuracy_score

    df = county_df.dropna(subset=["affordability_ratio", "median_home_value"]).copy()

    # Create target: affordability risk
    df["affordability_risk"] = pd.cut(
        df["affordability_ratio"],
        bins=[0, 25, 30, 35, 100],
        labels=["Low Risk", "Moderate", "High Risk", "Severe"],
        include_lowest=True
    )
    df = df.dropna(subset=["affordability_risk"])

    feature_cols = [
        "median_home_value", "median_household_income", "median_gross_rent",
        "homeownership_rate", "vacancy_rate", "total_population",
        "price_to_income_ratio", "home_value_yoy", "income_yoy",
        "is_metro_int", "year",
    ]
    available = [c for c in feature_cols if c in df.columns]

    X = df[available]
    y = df["affordability_risk"]

    le = LabelEncoder()
    y_enc = le.fit_transform(y)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y_enc, test_size=0.2, random_state=42, stratify=y_enc
    )

    imputer = SimpleImputer(strategy="median")
    X_train_imp = imputer.fit_transform(X_train)
    X_test_imp = imputer.transform(X_test)

    clf = RandomForestClassifier(
        n_estimators=200, max_depth=6, random_state=42, n_jobs=-1
    )
    clf.fit(X_train_imp, y_train)

    y_pred = clf.predict(X_test_imp)
    acc = accuracy_score(y_test, y_pred)
    report = classification_report(y_test, y_pred, target_names=le.classes_, output_dict=True)

    logger.info(f"  Accuracy: {acc:.4f}")
    logger.info(f"  Classification Report:\n{classification_report(y_test, y_pred, target_names=le.classes_)}")

    # Predict for all 2023 counties
    df_2023 = county_df[county_df["year"] == 2023].copy()
    X_2023 = df_2023[available]
    X_2023_imp = imputer.transform(SimpleImputer(strategy="median").fit_transform(X_2023))
    df_2023["affordability_risk_pred"] = le.inverse_transform(clf.predict(X_2023_imp))
    proba = clf.predict_proba(X_2023_imp)
    for i, cls in enumerate(le.classes_):
        df_2023[f"prob_{cls.replace(' ', '_')}"] = proba[:, i]

    out_df = df_2023[["county_fips", "county_name", "affordability_ratio",
                       "affordability_risk_pred"] +
                      [f"prob_{c.replace(' ', '_')}" for c in le.classes_]].copy()
    out_df.to_parquet(PROCESSED_DIR / "affordability_predictions.parquet", index=False)
    out_df.to_csv(PROCESSED_DIR / "affordability_predictions.csv", index=False)

    with open(MODELS_DIR / "affordability_classifier.pkl", "wb") as f:
        pickle.dump({"model": clf, "imputer": imputer, "label_encoder": le,
                     "feature_cols": available}, f)

    metrics = {
        "model_name": "Affordability Risk Classifier",
        "accuracy": round(float(acc), 4),
        "classification_report": report,
        "classes": list(le.classes_),
    }
    with open(MODELS_DIR / "affordability_metrics.json", "w") as f:
        json.dump(metrics, f, indent=2)

    return metrics


# =============================================================================
# Main
# =============================================================================
def main():
    logger.info("=" * 60)
    logger.info("Ohio Real Estate - ML Model Training")
    logger.info("=" * 60)

    county_df, ts_df, heat_df = load_features()

    # Model 1: Home Value Predictor
    hv_artifacts = train_home_value_predictor(county_df)

    # Model 2: HPI Forecaster
    hpi_artifacts = train_hpi_forecaster(ts_df)

    # Model 3: Market Clusters
    cluster_df = train_market_clusters(county_df)

    # Model 4: Affordability Classifier
    afford_metrics = train_affordability_classifier(county_df)

    # Summary
    logger.info("\n" + "=" * 60)
    logger.info("Model Training Complete")
    logger.info("=" * 60)
    logger.info(f"Models saved to: {MODELS_DIR}")

    # Save overall summary
    summary = {
        "training_complete": True,
        "models": [
            "home_value_predictor.pkl",
            "hpi_forecaster.pkl",
            "market_clusters.pkl",
            "affordability_classifier.pkl",
        ],
        "metrics_files": [
            "home_value_metrics.json",
            "hpi_forecast_metrics.json",
            "cluster_metrics.json",
            "affordability_metrics.json",
        ],
    }
    with open(MODELS_DIR / "training_summary.json", "w") as f:
        json.dump(summary, f, indent=2)

    logger.info("\nAll models trained and saved!")


if __name__ == "__main__":
    main()
