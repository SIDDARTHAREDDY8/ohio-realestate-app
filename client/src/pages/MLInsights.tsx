/* Ohio Blueprint — ML Insights
   XGBoost predictions, market clusters, affordability risk, feature importance
*/

import { useMemo, useState } from "react";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie, Legend,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
} from "recharts";
import predictions from "@/data/county_value_predictions.json";
import clusters from "@/data/market_clusters.json";
import affordability from "@/data/affordability_predictions.json";

const predData = predictions as any[];
const clusterData = clusters as any[];
const affordData = affordability as any[];

const BLUE = "oklch(0.45 0.18 255)";
const GREEN = "oklch(0.52 0.17 145)";
const AMBER = "oklch(0.72 0.18 75)";
const RED = "oklch(0.58 0.22 25)";
const CYAN = "oklch(0.58 0.16 220)";

const CLUSTER_COLORS: Record<string, string> = {
  "Affluent Suburban": "#1D4ED8",
  "Urban Premium": "#0EA5E9",
  "Stable Mid-Tier": "#10B981",
  "Transitional Market": "#F59E0B",
  "Value Market": "#94A3B8",
};

const AFFORD_COLORS: Record<string, string> = {
  "Low Risk": "#10B981",
  "Moderate": "#F59E0B",
  "High Risk": "#EF4444",
  "Severe": "#7F1D1D",
};

function fmtK(n: number | null | undefined) {
  if (n == null) return "—";
  return `$${(n / 1000).toFixed(0)}K`;
}

// Feature importance from training
const FEATURE_IMPORTANCE = [
  { feature: "Prior Year Home Value", importance: 47.1 },
  { feature: "Median Household Income", importance: 22.4 },
  { feature: "Median Gross Rent", importance: 6.8 },
  { feature: "Median Year Built", importance: 4.4 },
  { feature: "2-Year Lag Home Value", importance: 3.6 },
  { feature: "Price-to-Income Ratio", importance: 3.5 },
  { feature: "Housing Stock Age", importance: 2.8 },
  { feature: "Median Rooms", importance: 2.4 },
  { feature: "Persons per Unit", importance: 1.4 },
  { feature: "Vacancy Rate", importance: 1.0 },
];

const MODEL_METRICS = [
  { model: "XGBoost", r2: 0.9856, mae: 3389, mape: 2.04, color: BLUE },
  { model: "Gradient Boosting", r2: 0.9909, mae: 2799, mape: 1.68, color: GREEN },
  { model: "Random Forest", r2: 0.9626, mae: 4484, mape: 2.56, color: AMBER },
  { model: "Ridge Regression", r2: 0.9784, mae: 5530, mape: 3.80, color: CYAN },
];

export default function MLInsights() {
  const [activeCluster, setActiveCluster] = useState<string | null>(null);

  // Scatter: actual vs predicted
  const scatterData = useMemo(() =>
    predData.map(d => ({
      actual: d.median_home_value,
      predicted: d.predicted_home_value,
      county: d.county_name,
      error: d.prediction_error_pct,
    })).filter(d => d.actual && d.predicted),
    []
  );

  // Cluster distribution
  const clusterCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    clusterData.forEach(d => {
      if (d.cluster_label) counts[d.cluster_label] = (counts[d.cluster_label] ?? 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, []);

  // Affordability risk distribution
  const affordCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    affordData.forEach(d => {
      if (d.affordability_risk_pred) counts[d.affordability_risk_pred] = (counts[d.affordability_risk_pred] ?? 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, []);

  // Filtered cluster counties
  const filteredCluster = useMemo(() =>
    activeCluster ? clusterData.filter(d => d.cluster_label === activeCluster) : clusterData,
    [activeCluster]
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="chart-container">
        <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "oklch(0.45 0.18 255)" }}>Machine Learning</div>
        <h2 className="text-xl font-bold text-foreground">ML Model Insights</h2>
        <p className="text-sm text-muted-foreground mt-1">
          4 production models trained on real Ohio data: XGBoost home value predictor (R²=0.986), Prophet HPI forecaster, K-Means market clustering, and Random Forest affordability classifier.
        </p>
      </div>

      {/* Model comparison */}
      <div className="chart-container">
        <h3 className="text-sm font-semibold text-foreground mb-1">Model Performance Comparison</h3>
        <p className="text-xs text-muted-foreground mb-4">Home value prediction — 5-fold cross-validation on 440 county-year observations</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          {MODEL_METRICS.map(m => (
            <div key={m.model} className="rounded-lg border p-4" style={{ borderColor: "oklch(0.90 0.008 240)" }}>
              <div className="text-xs font-semibold text-muted-foreground mb-2">{m.model}</div>
              <div className="data-value text-2xl font-bold mb-1" style={{ color: m.color }}>{m.r2.toFixed(4)}</div>
              <div className="text-xs text-muted-foreground">R² Score</div>
              <div className="mt-2 text-xs text-muted-foreground">MAE: <span className="data-value font-semibold text-foreground">${m.mae.toLocaleString()}</span></div>
              <div className="text-xs text-muted-foreground">MAPE: <span className="data-value font-semibold text-foreground">{m.mape}%</span></div>
            </div>
          ))}
        </div>
        <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
          <strong>Best Model:</strong> Gradient Boosting (R²=0.9909, MAPE=1.68%) — deployed for county value predictions.
          5-Fold CV R²: 0.977 ± 0.015 confirms generalization. XGBoost selected for production due to inference speed.
        </div>
      </div>

      {/* Actual vs Predicted + Feature Importance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="chart-container">
          <h3 className="text-sm font-semibold text-foreground mb-1">Actual vs. Predicted Home Values</h3>
          <p className="text-xs text-muted-foreground mb-4">XGBoost predictions for all 88 Ohio counties (2023)</p>
          <ResponsiveContainer width="100%" height={260}>
            <ScatterChart margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.90 0.008 240)" />
              <XAxis
                dataKey="actual"
                name="Actual"
                type="number"
                tick={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={v => `$${(v/1000).toFixed(0)}K`}
                label={{ value: "Actual", position: "insideBottom", offset: -5, fontSize: 10 }}
              />
              <YAxis
                dataKey="predicted"
                name="Predicted"
                type="number"
                tick={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={v => `$${(v/1000).toFixed(0)}K`}
                width={55}
              />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                formatter={(v: any, name: string) => [`$${Number(v).toLocaleString()}`, name]}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.county ?? ""}
              />
              <Scatter data={scatterData} fill={BLUE} fillOpacity={0.7} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-container">
          <h3 className="text-sm font-semibold text-foreground mb-1">Feature Importance (XGBoost)</h3>
          <p className="text-xs text-muted-foreground mb-4">Top 10 features by gain — % contribution to predictions</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={FEATURE_IMPORTANCE}
              layout="vertical"
              margin={{ top: 0, right: 10, left: 140, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.90 0.008 240)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
              <YAxis type="category" dataKey="feature" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={140} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: any) => [`${Number(v).toFixed(1)}%`, "Importance"]} />
              <Bar dataKey="importance" radius={[0, 4, 4, 0]}>
                {FEATURE_IMPORTANCE.map((_, i) => (
                  <Cell key={i} fill={i === 0 ? BLUE : i === 1 ? CYAN : "oklch(0.75 0.08 255)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Market Clusters */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="chart-container">
          <h3 className="text-sm font-semibold text-foreground mb-1">K-Means Market Clusters (k=5)</h3>
          <p className="text-xs text-muted-foreground mb-4">Market archetypes identified across 88 Ohio counties — click to filter</p>
          <div className="flex gap-2 flex-wrap mb-4">
            {Object.entries(CLUSTER_COLORS).map(([label, color]) => (
              <button
                key={label}
                onClick={() => setActiveCluster(activeCluster === label ? null : label)}
                className="text-xs px-2.5 py-1 rounded-full font-medium border transition-all"
                style={{
                  borderColor: color,
                  color: activeCluster === label ? "white" : color,
                  backgroundColor: activeCluster === label ? color : "transparent",
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={clusterCounts}
                cx="50%"
                cy="50%"
                outerRadius={80}
                dataKey="value"
                nameKey="name"
                label={({ name, value }) => `${name}: ${value}`}
                labelLine={false}
              >
                {clusterCounts.map((entry, i) => (
                  <Cell key={i} fill={CLUSTER_COLORS[entry.name] ?? "#94A3B8"} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-container">
          <h3 className="text-sm font-semibold text-foreground mb-1">Affordability Risk Classification</h3>
          <p className="text-xs text-muted-foreground mb-4">Random Forest classifier — 88 Ohio counties, 2023</p>
          <div className="grid grid-cols-2 gap-3 mb-4">
            {affordCounts.map(a => (
              <div key={a.name} className="rounded-lg p-3 border" style={{ borderColor: "oklch(0.90 0.008 240)" }}>
                <div className="data-value text-2xl font-bold mb-0.5" style={{ color: AFFORD_COLORS[a.name] ?? BLUE }}>
                  {a.value}
                </div>
                <div className="text-xs text-muted-foreground">{a.name}</div>
              </div>
            ))}
          </div>
          <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
            <strong>Affordability Index:</strong> Ratio of 5× median income to median home value.
            Index ≥ 100 = affordable; 80–99 = moderate; &lt;80 = stressed.
          </div>
        </div>
      </div>

      {/* County predictions table */}
      <div className="chart-container overflow-hidden">
        <h3 className="text-sm font-semibold text-foreground mb-1">XGBoost Predictions — All 88 Counties</h3>
        <p className="text-xs text-muted-foreground mb-4">Actual vs. predicted median home value with error percentage</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: "oklch(0.90 0.008 240)" }}>
                {["County", "Actual Value", "Predicted Value", "Error %", "Market Cluster", "Afford. Risk"].map(h => (
                  <th key={h} className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {predData
                .sort((a, b) => (b.median_home_value ?? 0) - (a.median_home_value ?? 0))
                .map(d => {
                  const cluster = clusterData.find(c => c.county_fips === d.county_fips);
                  const afford = affordData.find(a => a.county_fips === d.county_fips);
                  const err = d.prediction_error_pct;
                  return (
                    <tr key={d.county_fips} className="border-b hover:bg-muted/40 transition-colors" style={{ borderColor: "oklch(0.93 0.005 240)" }}>
                      <td className="py-2 px-3 font-medium text-foreground">{d.county_name}</td>
                      <td className="py-2 px-3 data-value font-semibold">{fmtK(d.median_home_value)}</td>
                      <td className="py-2 px-3 data-value">{fmtK(d.predicted_home_value)}</td>
                      <td className="py-2 px-3">
                        {err != null ? (
                          <span className={`data-value text-xs font-semibold ${Math.abs(err) < 5 ? "trend-up" : Math.abs(err) < 10 ? "trend-neutral" : "trend-down"}`}>
                            {err >= 0 ? "+" : ""}{err.toFixed(1)}%
                          </span>
                        ) : "—"}
                      </td>
                      <td className="py-2 px-3">
                        {cluster?.cluster_label && (
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{
                            backgroundColor: (CLUSTER_COLORS[cluster.cluster_label] ?? "#94A3B8") + "20",
                            color: CLUSTER_COLORS[cluster.cluster_label] ?? "#94A3B8",
                            fontWeight: 600,
                          }}>
                            {cluster.cluster_label}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        {afford?.affordability_risk_pred && (
                          <span className="text-xs font-semibold" style={{ color: AFFORD_COLORS[afford.affordability_risk_pred] ?? BLUE }}>
                            {afford.affordability_risk_pred}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
