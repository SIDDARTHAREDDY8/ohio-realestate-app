/*
 * Compare Counties — side-by-side comparison of up to 3 Ohio counties.
 * Best-in-row highlighting, plus a home-value bar chart.
 */

import { useState, useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import countySummary from "@/data/county_summary.json";
import { cn } from "@/lib/utils";

const counties = countySummary as any[];
const byFips = new Map(counties.map(c => [c.county_fips, c]));

const DEFAULTS = ["39049", "39035", "39061"]; // Franklin, Cuyahoga, Hamilton

function fmtK(n: number | null | undefined) {
  if (n == null) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${Math.round(n)}`;
}
function fmtInt(n: number | null | undefined) {
  if (n == null) return "—";
  return Math.round(n).toLocaleString("en-US");
}
function pct(n: number | null | undefined, dec = 1) {
  if (n == null) return "—";
  return `${n.toFixed(dec)}%`;
}

interface Row {
  label: string;
  get: (c: any) => number | string | null;
  format: (v: any) => string;
  /** "low" | "high" — which extreme wins the highlight, or null for no highlight */
  better: "low" | "high" | null;
}

const ROWS: Row[] = [
  { label: "Median Home Value", get: c => c.median_home_value_2023, format: v => fmtK(v), better: "low" },
  { label: "Median Rent / Mo", get: c => c.median_rent_2023, format: v => (v == null ? "—" : `$${Math.round(v).toLocaleString()}`), better: "low" },
  { label: "Median Household Income", get: c => c.median_income_2023, format: v => fmtK(v), better: "high" },
  { label: "5-Yr Home Value Change", get: c => c.home_value_5yr_change, format: v => pct(v), better: "high" },
  { label: "5-Yr Rent Change", get: c => c.rent_5yr_change, format: v => pct(v), better: "low" },
  { label: "Homeownership Rate", get: c => c.homeownership_rate_2023, format: v => pct(v), better: "high" },
  { label: "Vacancy Rate", get: c => c.vacancy_rate_2023, format: v => pct(v), better: "low" },
  { label: "Population", get: c => c.total_population_2023, format: v => fmtInt(v), better: "high" },
  { label: "Region", get: c => c.region, format: v => v ?? "—", better: null },
  { label: "Metro Area", get: c => c.metro_area, format: v => v ?? "Non-metro", better: null },
];

const BAR_COLORS = ["oklch(0.55 0.16 250)", "oklch(0.48 0.16 145)", "oklch(0.62 0.18 35)"];

export default function CompareCounties() {
  const [picks, setPicks] = useState<string[]>(DEFAULTS);

  const selected = useMemo(
    () => picks.map(f => byFips.get(f)).filter(Boolean),
    [picks]
  );

  function setPick(i: number, fips: string) {
    setPicks(prev => prev.map((p, j) => (j === i ? fips : p)));
  }

  const chartData = selected.map((c, i) => ({
    name: c.county_name.replace(" County", ""),
    value: c.median_home_value_2023 ?? 0,
    color: BAR_COLORS[i % BAR_COLORS.length],
  }));

  function bestIndex(row: Row): number {
    if (!row.better) return -1;
    let best = -1;
    let bestVal: number | null = null;
    selected.forEach((c, i) => {
      const v = row.get(c);
      if (typeof v !== "number" || !Number.isFinite(v)) return;
      if (bestVal == null ||
          (row.better === "low" ? v < bestVal : v > bestVal)) {
        bestVal = v;
        best = i;
      }
    });
    return best;
  }

  return (
    <div className="p-4 space-y-4">
      {/* ── Executive Header ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-3 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Compare Counties</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pick up to three counties and compare them side by side. Green marks the best value in each row.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="badge-cached">Census ACS · 2023 5-yr</span>
        </div>
      </div>

      {/* ── County pickers ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {picks.map((fips, i) => (
          <div key={i}>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              County {i + 1}
            </label>
            <Select value={fips} onValueChange={v => setPick(i, v)}>
              <SelectTrigger className="mt-1 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {counties.map(c => (
                  <SelectItem key={c.county_fips} value={c.county_fips}>
                    {c.county_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>

      {/* ── Head-to-head table ── */}
      <div className="panel">
        <div className="section-header">
          <span className="section-title">Head-to-Head</span>
          <span className="source-tag">Census ACS 2023</span>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table min-w-[560px]">
            <thead>
              <tr>
                <th className="w-44">Metric</th>
                {selected.map((c, i) => (
                  <th key={c.county_fips} className="!text-right font-bold"
                      style={{ color: BAR_COLORS[i % BAR_COLORS.length] }}>
                    {c.county_name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map(row => {
                const bi = bestIndex(row);
                return (
                  <tr key={row.label}>
                    <td className="text-muted-foreground font-medium">{row.label}</td>
                    {selected.map((c, i) => {
                      const v = row.get(c);
                      const isBest = i === bi;
                      return (
                        <td key={c.county_fips}
                            className={cn(
                              "mono !text-right font-semibold",
                              isBest && "text-[oklch(0.42_0.14_145)] bg-[oklch(0.48_0.16_145)/0.08]"
                            )}>
                          {row.format(v)}
                          {isBest && <span className="ml-1 text-xs">●</span>}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Home value chart ── */}
      <div className="panel">
        <div className="section-header">
          <span className="section-title">Median Home Value</span>
          <span className="source-tag">Census ACS 2023</span>
        </div>
        <div className="h-64 p-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 24 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tickFormatter={v => `$${Math.round(v / 1000)}K`}
                     tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: any) => [`$${Math.round(v).toLocaleString()}`, "Home Value"]}
                       contentStyle={{ fontSize: 12 }} />
              <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                {chartData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <p className="source-tag">
        Source: US Census Bureau, American Community Survey 5-Year 2023. "Best" is directional
        (e.g. lower price favors buyers, higher appreciation favors owners) — not financial advice.
      </p>
    </div>
  );
}
