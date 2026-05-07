/*
 * ML Insights — Data Terminal style
 * Model metrics, feature importance, predictions, clusters — all data-first
 */

import { useMemo, useState } from "react";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
} from "recharts";
import { ExternalLink } from "lucide-react";
import predictions from "@/data/county_value_predictions.json";
import clusters from "@/data/market_clusters.json";
import affordability from "@/data/affordability_predictions.json";

const predData = predictions as any[];
const clusterData = clusters as any[];
const affordData = affordability as any[];

const C1 = "oklch(0.38 0.12 250)";
const C2 = "oklch(0.52 0.14 220)";
const C3 = "oklch(0.48 0.16 145)";
const C4 = "oklch(0.55 0.20 25)";
const C5 = "oklch(0.62 0.18 75)";

const CHART_STYLE = { fontSize: 10, fontFamily: "'IBM Plex Mono', monospace" };

function fmtK(n: number | null | undefined) {
  if (n == null) return "—";
  return `$${(n / 1000).toFixed(0)}K`;
}

function SectionHeader({ title, source, note }: { title: string; source?: string; note?: string }) {
  return (
    <div className="section-header">
      <span className="section-title">{title}</span>
      <div className="flex items-center gap-3">
        {note && <span className="source-tag">{note}</span>}
        {source && <span className="source-tag">{source}</span>}
      </div>
    </div>
  );
}

const FEATURE_IMPORTANCE = [
  { feature: "Prior Year Home Value (lag1)", importance: 47.1, category: "lag" },
  { feature: "Median Household Income", importance: 22.4, category: "economic" },
  { feature: "Median Gross Rent", importance: 6.8, category: "housing" },
  { feature: "Median Year Built", importance: 4.4, category: "housing" },
  { feature: "2-Year Lag Home Value", importance: 3.6, category: "lag" },
  { feature: "Price-to-Income Ratio", importance: 3.5, category: "derived" },
  { feature: "Housing Stock Age", importance: 2.8, category: "derived" },
  { feature: "Median Rooms", importance: 2.4, category: "housing" },
  { feature: "Persons per Unit", importance: 1.4, category: "derived" },
  { feature: "Vacancy Rate", importance: 1.0, category: "housing" },
];

const MODEL_COMPARISON = [
  { model: "XGBoost", r2: 0.9856, mae: 3389, mape: 2.04, cv_r2: "0.977±0.015", color: C1 },
  { model: "Gradient Boosting", r2: 0.9909, mae: 2799, mape: 1.68, cv_r2: "—", color: C3 },
  { model: "Random Forest", r2: 0.9626, mae: 4484, mape: 2.56, cv_r2: "—", color: C2 },
  { model: "Ridge Regression", r2: 0.9784, mae: 5530, mape: 3.80, cv_r2: "—", color: C5 },
];

const CLUSTER_COLORS: Record<string, string> = {
  "Affluent Suburban": C1,
  "Urban Premium": C2,
  "Stable Mid-Tier": C3,
  "Transitional Market": C5,
  "Value Market": "oklch(0.65 0.005 240)",
};

const AFFORD_COLORS: Record<string, string> = {
  "Low Risk": C3,
  "Moderate": C5,
  "High Risk": C4,
  "Severe": "oklch(0.40 0.22 25)",
};

export default function MLInsights() {
  const [activeCluster, setActiveCluster] = useState<string | null>(null);

  const scatterData = useMemo(() =>
    predData.map(d => ({
      actual: d.median_home_value,
      predicted: d.predicted_home_value,
      county: d.county_name,
      error: d.prediction_error_pct,
    })).filter(d => d.actual && d.predicted),
    []
  );

  const clusterCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    clusterData.forEach(d => {
      if (d.cluster_label) counts[d.cluster_label] = (counts[d.cluster_label] ?? 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, []);

  const affordCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    affordData.forEach(d => {
      if (d.affordability_risk_pred) counts[d.affordability_risk_pred] = (counts[d.affordability_risk_pred] ?? 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, []);

  const filteredCluster = useMemo(() =>
    activeCluster ? clusterData.filter(d => d.cluster_label === activeCluster) : clusterData,
    [activeCluster]
  );

  return (
    <div className="p-4 space-y-4">

      {/* Model comparison table */}
      <div className="panel">
        <SectionHeader title="Model Comparison — Home Value Prediction" source="XGBoost 2.0 + scikit-learn 1.4" note="Target: median_home_value · 440 county-year observations · 80/20 train/test split" />
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Model</th>
                <th>R² (test)</th>
                <th>MAE</th>
                <th>MAPE</th>
                <th>5-Fold CV R²</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {MODEL_COMPARISON.map(m => (
                <tr key={m.model}>
                  <td style={{ fontWeight: 500 }}>{m.model}</td>
                  <td className="mono font-semibold" style={{ color: m.color }}>{m.r2.toFixed(4)}</td>
                  <td className="mono">${m.mae.toLocaleString()}</td>
                  <td className="mono">{m.mape.toFixed(2)}%</td>
                  <td className="mono">{m.cv_r2}</td>
                  <td>
                    {m.model === "XGBoost" ? (
                      <span className="source-tag" style={{ color: C3, fontWeight: 600 }}>● DEPLOYED</span>
                    ) : (
                      <span className="source-tag">baseline</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-3 py-2 source-tag" style={{ borderTop: "1px solid var(--border)" }}>
          XGBoost selected for production (inference speed). Gradient Boosting achieves marginally better test metrics but slower prediction.
          CV R² = 0.977 ± 0.015 confirms model generalizes well across counties and years.
        </div>
      </div>

      {/* Scatter + Feature importance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="panel">
          <SectionHeader title="Actual vs. Predicted — 88 Ohio Counties (2023)" source="XGBoost" note="Perfect prediction = diagonal line" />
          <div className="p-3">
            <ResponsiveContainer width="100%" height={240}>
              <ScatterChart margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="oklch(0.90 0.004 240)" />
                <XAxis
                  dataKey="actual" name="Actual" type="number"
                  tick={CHART_STYLE} tickLine={false} axisLine={false}
                  tickFormatter={v => `$${(v/1000).toFixed(0)}K`}
                  label={{ value: "Actual ($)", position: "insideBottom", offset: -5, fontSize: 10, fontFamily: "'IBM Plex Mono', monospace" }}
                />
                <YAxis
                  dataKey="predicted" name="Predicted" type="number"
                  tick={CHART_STYLE} tickLine={false} axisLine={false}
                  tickFormatter={v => `$${(v/1000).toFixed(0)}K`}
                  width={52}
                />
                <Tooltip
                  contentStyle={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", borderRadius: 2 }}
                  formatter={(v: any, name: string) => [`$${Number(v).toLocaleString()}`, name]}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.county ?? ""}
                />
                <Scatter data={scatterData} fill={C1} fillOpacity={0.65} r={4} />
              </ScatterChart>
            </ResponsiveContainer>
            <div className="source-tag mt-1">
              Outliers above diagonal = model underestimates (Delaware, Warren counties).
              R²=0.986 means 98.6% of variance in home values explained by the 21 features.
            </div>
          </div>
        </div>

        <div className="panel">
          <SectionHeader title="Feature Importance (XGBoost Gain)" source="xgboost.get_score(importance_type='gain')" />
          <div className="p-3">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                data={FEATURE_IMPORTANCE}
                layout="vertical"
                margin={{ top: 0, right: 8, left: 155, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="2 4" stroke="oklch(0.90 0.004 240)" horizontal={false} />
                <XAxis type="number" tick={CHART_STYLE} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
                <YAxis type="category" dataKey="feature" tick={{ ...CHART_STYLE, fontSize: 9 }} tickLine={false} axisLine={false} width={155} />
                <Tooltip contentStyle={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", borderRadius: 2 }} formatter={(v: any) => [`${Number(v).toFixed(1)}%`, "Importance"]} />
                <Bar dataKey="importance" radius={[0, 2, 2, 0]}>
                  {FEATURE_IMPORTANCE.map((entry, i) => (
                    <Cell key={i} fill={entry.category === "lag" ? C1 : entry.category === "economic" ? C3 : entry.category === "derived" ? C5 : C2} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="source-tag mt-1">
              <span style={{ color: C1 }}>■</span> Lag features &nbsp;
              <span style={{ color: C3 }}>■</span> Economic &nbsp;
              <span style={{ color: C2 }}>■</span> Housing stock &nbsp;
              <span style={{ color: C5 }}>■</span> Derived ratios
            </div>
          </div>
        </div>
      </div>

      {/* Clusters + Affordability */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="panel">
          <SectionHeader title="K-Means Market Clusters (k=5)" source="scikit-learn KMeans" note="9 features · StandardScaler · 20 inits · Elbow: k=2–8" />
          <div className="px-3 py-2 flex flex-wrap gap-1.5" style={{ borderBottom: "1px solid var(--border)" }}>
            {Object.entries(CLUSTER_COLORS).map(([label, color]) => (
              <button
                key={label}
                onClick={() => setActiveCluster(activeCluster === label ? null : label)}
                className="text-xs px-2 py-0.5 rounded transition-all"
                style={{
                  border: `1px solid ${color}`,
                  color: activeCluster === label ? "white" : color,
                  background: activeCluster === label ? color : "transparent",
                  fontFamily: "'IBM Plex Mono', monospace",
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="p-3">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={clusterCounts}
                  cx="50%"
                  cy="50%"
                  outerRadius={70}
                  dataKey="value"
                  nameKey="name"
                  label={({ name, value }) => `${name}: ${value}`}
                  labelLine={false}
                >
                  {clusterCounts.map((entry, i) => (
                    <Cell key={i} fill={CLUSTER_COLORS[entry.name] ?? "oklch(0.65 0.005 240)"} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", borderRadius: 2 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="source-tag mt-1">76 of 88 counties = Value Market. Ohio is predominantly affordable vs. coastal markets.</div>
          </div>
        </div>

        <div className="panel">
          <SectionHeader title="Affordability Risk Classification" source="Random Forest Classifier" note="4-class · 11 features · stratified 80/20 split · acc=0.89+" />
          <div className="p-3">
            <div className="grid grid-cols-2 gap-3 mb-3">
              {affordCounts.map(a => (
                <div key={a.name} className="panel p-3">
                  <div className="data-value text-2xl font-bold mb-0.5" style={{ color: AFFORD_COLORS[a.name] ?? C1 }}>
                    {a.value}
                  </div>
                  <div className="source-tag">{a.name}</div>
                </div>
              ))}
            </div>
            <div className="source-tag">
              Affordability Index = (5 × median income) / median home value × 100.
              Low Risk ≥ 100 · Moderate 80–99 · High Risk 60–79 · Severe &lt; 60.
            </div>
          </div>
        </div>
      </div>

      {/* Full predictions table */}
      <div className="panel overflow-hidden">
        <SectionHeader
          title="XGBoost Predictions — All 88 Ohio Counties (2023)"
          source="pipeline/src/models/train_models.py"
          note="Sorted by actual home value descending"
        />
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>County</th>
                <th>Actual Value</th>
                <th>Predicted Value</th>
                <th>Error %</th>
                <th>Market Cluster</th>
                <th>Afford. Risk</th>
              </tr>
            </thead>
            <tbody>
              {predData
                .sort((a, b) => (b.median_home_value ?? 0) - (a.median_home_value ?? 0))
                .map((d, i) => {
                  const cluster = clusterData.find(c => c.county_fips === d.county_fips);
                  const afford = affordData.find(a => a.county_fips === d.county_fips);
                  const err = d.prediction_error_pct;
                  return (
                    <tr key={d.county_fips}>
                      <td className="mono" style={{ color: "var(--muted-foreground)" }}>{i + 1}</td>
                      <td style={{ fontWeight: 500 }}>{d.county_name}</td>
                      <td className="mono font-semibold">{fmtK(d.median_home_value)}</td>
                      <td className="mono">{fmtK(d.predicted_home_value)}</td>
                      <td>
                        {err != null ? (
                          <span className={`mono text-xs font-semibold ${Math.abs(err) < 5 ? "trend-up" : Math.abs(err) < 10 ? "" : "trend-down"}`}>
                            {err >= 0 ? "+" : ""}{err.toFixed(1)}%
                          </span>
                        ) : "—"}
                      </td>
                      <td>
                        {cluster?.cluster_label && (
                          <span className="source-tag" style={{ color: CLUSTER_COLORS[cluster.cluster_label] ?? "var(--muted-foreground)", fontWeight: 600 }}>
                            {cluster.cluster_label}
                          </span>
                        )}
                      </td>
                      <td>
                        {afford?.affordability_risk_pred && (
                          <span className="source-tag font-semibold" style={{ color: AFFORD_COLORS[afford.affordability_risk_pred] ?? C1 }}>
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
