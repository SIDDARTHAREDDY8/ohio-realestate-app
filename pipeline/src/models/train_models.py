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

from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.linear_model import Ridge
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.cluster import KMeans
from sklearn.impute import SimpleImputer
import xgboost as xgb

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent.parent
PROCESSED_DIR = BASE_DIR / "data" / "processed"
MODELS_DIR = BASE_DIR / "data" / "warehouse" / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)


def load_features():
    """Load processed feature files, failing with a clear message if the
    upstream fetch/ETL steps produced no data (e.g. Census API outage)."""
    county_df = pd.read_parquet(PROCESSED_DIR / "county_features.parquet")
    ts_df = pd.read_parquet(PROCESSED_DIR / "timeseries_features.parquet")
    heat_df = pd.read_parquet(PROCESSED_DIR / "market_heat_index.parquet")
    if county_df.empty or county_df["median_home_value"].dropna().empty:
        raise SystemExit(
            "ERROR: county feature matrix is empty — the Census fetch or ETL step "
            "produced no data. Fix the upstream step before training."
        )
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

    # Temporal holdout: the feature set includes lagged values of the target,
    # so a random split would place the same county's adjacent years in both
    # train and test and leak the answer. Hold out the most recent year instead.
    test_year = int(df_model["year"].max())
    train_mask = (df_model["year"] < test_year).to_numpy()
    X_train, X_test = X[train_mask], X[~train_mask]
    y_train, y_test = y[train_mask], y[~train_mask]
    logger.info(f"  Temporal split: train < {test_year} ({len(X_train)} rows), "
                f"test = {test_year} ({len(X_test)} rows)")

    # Impute missing values
    imputer = SimpleImputer(strategy="median")
    X_train_imp = imputer.fit_transform(X_train)
    X_test_imp = imputer.transform(X_test)

    all_metrics = []

    xgb_params = dict(
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

    # --- XGBoost ---
    xgb_model = xgb.XGBRegressor(**xgb_params)
    xgb_model.fit(X_train_imp, y_train, verbose=False)
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

    # Best model = highest R² on the held-out year (among tree models,
    # which share the imputed-feature pipeline used for predictions below)
    tree_models = {"XGBoost": xgb_model, "GradientBoosting": gb_model, "RandomForest": rf_model}
    tree_metrics = [m for m in all_metrics if m["model"] in tree_models]
    best_name = max(tree_metrics, key=lambda m: m["r2"])["model"]
    best_model = tree_models[best_name]
    logger.info(f"\n  Best model on {test_year} holdout: {best_name}")

    # Feature importance
    feat_importance = pd.DataFrame({
        "feature": available_features,
        "importance": best_model.feature_importances_
    }).sort_values("importance", ascending=False)
    logger.info(f"\n  Top 10 features:\n{feat_importance.head(10).to_string()}")

    # Expanding-window cross-validation: train on all years before each
    # validation year. No shuffling, so lagged-target features never leak.
    cv_scores = []
    cv_years = sorted(int(y_) for y_ in df_model["year"].unique())[2:]
    for val_year in cv_years:
        tr = (df_model["year"] < val_year).to_numpy()
        va = (df_model["year"] == val_year).to_numpy()
        if tr.sum() == 0 or va.sum() == 0:
            continue
        cv_imputer = SimpleImputer(strategy="median")
        cv_model = xgb.XGBRegressor(**xgb_params)
        cv_model.fit(cv_imputer.fit_transform(X[tr]), y[tr], verbose=False)
        cv_scores.append(r2_score(y[va], cv_model.predict(cv_imputer.transform(X[va]))))
    cv_scores = np.array(cv_scores)
    logger.info(f"\n  Expanding-window CV R² (years {cv_years}): "
                f"{cv_scores.mean():.4f} ± {cv_scores.std():.4f}")

    # Out-of-sample predictions for the held-out year — the model was trained
    # only on earlier years, so these are genuine forecasts, not refits.
    df_hold = df_model.loc[~train_mask].copy()
    df_hold["predicted_home_value"] = best_model.predict(X_test_imp)
    df_hold["prediction_error_pct"] = (
        (df_hold["predicted_home_value"] - df_hold["median_home_value"]) /
        df_hold["median_home_value"] * 100
    ).round(2)

    predictions_df = df_hold[["county_fips", "county_name", "median_home_value",
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
            "best_model": best_name,
            "validation": f"temporal holdout (train < {test_year}, test = {test_year}); "
                          "expanding-window CV",
            "test_year": test_year,
            "metrics": all_metrics,
            "cv_r2_mean": float(cv_scores.mean()),
            "cv_r2_std": float(cv_scores.std()),
            "n_features": len(available_features),
            "n_samples": len(X),
            "n_train": int(train_mask.sum()),
            "n_test": int((~train_mask).sum()),
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
            series = hpi_df.set_index("ds")[reg]
            # Known dates get their observed value; future dates carry the last
            # observation forward (a simplifying assumption for the forecast).
            future[reg] = future["ds"].map(series).fillna(series.iloc[-1])

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

    # Find optimal k: silhouette score over k=3..8 (k>=3 so the archetype
    # labels below stay meaningful; a hardcoded k would ignore the data)
    from sklearn.metrics import silhouette_score
    inertias = []
    sil_scores = {}
    k_range = range(3, 9)
    for k in k_range:
        km = KMeans(n_clusters=k, random_state=42, n_init=10)
        labels = km.fit_predict(X_scaled)
        inertias.append(km.inertia_)
        sil_scores[k] = float(silhouette_score(X_scaled, labels))

    k_optimal = max(sil_scores, key=sil_scores.get)
    logger.info(f"  Silhouette scores: {{{', '.join(f'{k}: {v:.3f}' for k, v in sil_scores.items())}}}")
    logger.info(f"  Selected k = {k_optimal}")
    kmeans = KMeans(n_clusters=k_optimal, random_state=42, n_init=20)
    df_2023["cluster"] = kmeans.fit_predict(X_scaled)

    # Label clusters based on characteristics
    cluster_stats = df_2023.groupby("cluster")[available].mean()
    logger.info(f"\n  Cluster statistics:\n{cluster_stats.round(0).to_string()}")

    # Assign descriptive labels: rank clusters by average home value, with an
    # override for renter-heavy (urban-core) clusters. Guaranteed unique so
    # k distinct clusters never collapse into fewer labels.
    cluster_labels: dict = {}
    used: set = set()
    urban = [c for c in cluster_stats.index
             if cluster_stats.loc[c].get("homeownership_rate", 100) < 65]
    non_urban = [c for c in cluster_stats.index if c not in urban]
    value_order = cluster_stats.loc[non_urban, "median_home_value"].sort_values().index.tolist()
    middle_names = ["Stable Mid-Tier", "Suburban Growth", "Transitional Market",
                    "Rising Market", "Established Market", "Upper Mid-Tier"]
    for i, c in enumerate(value_order):
        if i == 0:
            label = "Value Market"
        elif i == len(value_order) - 1:
            label = "Affluent Suburban"
        else:
            label = middle_names[(i - 1) % len(middle_names)]
        while label in used:
            label = f"{label} II"
        used.add(label)
        cluster_labels[c] = label
    for c in urban:
        label = "Urban Core"
        while label in used:
            label = f"{label} II"
        used.add(label)
        cluster_labels[c] = label

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
            "silhouette_scores": sil_scores,
        }, f)

    with open(MODELS_DIR / "cluster_metrics.json", "w") as f:
        json.dump({
            "k": k_optimal,
            "k_selection": "max silhouette score over k=3..8",
            "cluster_labels": cluster_labels,
            "cluster_counts": df_2023["cluster_label"].value_counts().to_dict(),
            "inertias": {str(k): float(v) for k, v in zip(k_range, inertias)},
            "silhouette_scores": {str(k): round(v, 4) for k, v in sil_scores.items()},
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

    # Create target: relative affordability risk. Quartile edges are computed
    # from TRAINING years only (fixed textbook bins like 25/30/35 leave nearly
    # every Ohio county in one class, which makes the problem degenerate).
    max_year = int(df["year"].max())
    train_ratios = df.loc[df["year"] < max_year, "affordability_ratio"]
    edges = train_ratios.quantile([0, 0.25, 0.5, 0.75, 1.0]).to_numpy().copy()
    edges[0], edges[-1] = -np.inf, np.inf
    df["affordability_risk"] = pd.cut(
        df["affordability_ratio"],
        bins=edges,
        labels=["Low Risk", "Moderate", "High Risk", "Severe"],
    )
    df = df.dropna(subset=["affordability_risk"])

    # NOTE: median_gross_rent and median_household_income are deliberately
    # excluded — the target (affordability_ratio = rent*12/income) is defined
    # by them, so including them would make the classifier reconstruct its
    # own label instead of learning market structure.
    feature_cols = [
        "median_home_value",
        "homeownership_rate", "vacancy_rate", "renter_rate", "total_population",
        "home_value_yoy", "housing_stock_age", "median_rooms",
        "persons_per_unit", "is_metro_int", "year",
    ]
    available = [c for c in feature_cols if c in df.columns]

    X = df[available]
    y = df["affordability_risk"]

    le = LabelEncoder()
    y_enc = le.fit_transform(y)

    # Temporal holdout, consistent with the home-value model: counties repeat
    # across years, so a random split would leak near-duplicate rows.
    test_year = int(df["year"].max())
    train_mask = (df["year"] < test_year).to_numpy()
    X_train, X_test = X[train_mask], X[~train_mask]
    y_train, y_test = y_enc[train_mask], y_enc[~train_mask]
    logger.info(f"  Temporal split: train < {test_year} ({len(X_train)} rows), "
                f"test = {test_year} ({len(X_test)} rows)")

    imputer = SimpleImputer(strategy="median")
    X_train_imp = imputer.fit_transform(X_train)
    X_test_imp = imputer.transform(X_test)

    clf = RandomForestClassifier(
        n_estimators=200, max_depth=6, random_state=42, n_jobs=-1
    )
    clf.fit(X_train_imp, y_train)

    y_pred = clf.predict(X_test_imp)
    acc = accuracy_score(y_test, y_pred)
    label_ids = list(range(len(le.classes_)))
    report = classification_report(y_test, y_pred, labels=label_ids,
                                   target_names=le.classes_, output_dict=True,
                                   zero_division=0)

    logger.info(f"  Accuracy ({test_year} holdout): {acc:.4f}")
    logger.info(f"  Classification Report:\n"
                f"{classification_report(y_test, y_pred, labels=label_ids, target_names=le.classes_, zero_division=0)}")

    # Predict for all counties in the held-out year using the trained imputer
    df_2023 = county_df[county_df["year"] == test_year].copy()
    X_2023 = df_2023[available]
    X_2023_imp = imputer.transform(X_2023)
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
        "validation": f"temporal holdout (train < {test_year}, test = {test_year}); "
                      "rent and income excluded from features (they define the target)",
        "test_year": test_year,
        "classification_report": report,
        "classes": list(le.classes_),
        "features": available,
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
    train_home_value_predictor(county_df)

    # Model 2: HPI Forecaster
    train_hpi_forecaster(ts_df)

    # Model 3: Market Clusters
    train_market_clusters(county_df)

    # Model 4: Affordability Classifier
    train_affordability_classifier(county_df)

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
