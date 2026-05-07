/* Ohio Blueprint — County Explorer
   Interactive table of all 88 Ohio counties with filtering, sorting, and detail panel
*/

import { useState, useMemo } from "react";
import { Search, SortAsc, SortDesc, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import countySummary from "@/data/county_summary.json";
import marketHeat from "@/data/market_heat_index.json";
import clusters from "@/data/market_clusters.json";

const counties = countySummary as any[];
const heatData = marketHeat as any[];
const clusterData = clusters as any[];

function fmtK(n: number | null | undefined) {
  if (n == null) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function pct(n: number | null | undefined, decimals = 1) {
  if (n == null) return "—";
  return `${n.toFixed(decimals)}%`;
}

type SortKey = "county_name" | "median_home_value_2023" | "median_rent_2023" | "homeownership_rate_2023" | "home_value_5yr_change" | "affordability_index";

const REGIONS = ["All Regions", "Central", "Northeast", "Southwest", "Northwest", "Southeast"];

export default function CountyExplorer() {
  const [search, setSearch] = useState("");
  const [region, setRegion] = useState("All Regions");
  const [sortKey, setSortKey] = useState<SortKey>("median_home_value_2023");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selected, setSelected] = useState<any | null>(null);

  const filtered = useMemo(() => {
    let data = [...counties];
    if (search) data = data.filter(c => c.county_name?.toLowerCase().includes(search.toLowerCase()));
    if (region !== "All Regions") data = data.filter(c => c.region === region);
    data.sort((a, b) => {
      const av = a[sortKey] ?? (sortDir === "asc" ? Infinity : -Infinity);
      const bv = b[sortKey] ?? (sortDir === "asc" ? Infinity : -Infinity);
      if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return data;
  }, [search, region, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <span className="w-3 h-3 inline-block opacity-30">↕</span>;
    return sortDir === "asc" ? <SortAsc className="w-3 h-3 inline-block" /> : <SortDesc className="w-3 h-3 inline-block" />;
  }

  // Get heat and cluster for selected county
  const selectedHeat = selected ? heatData.find(h => h.county_fips === selected.county_fips) : null;
  const selectedCluster = selected ? clusterData.find(c => c.county_fips === selected.county_fips) : null;

  // Radar chart data for selected county
  const radarData = selected ? [
    { metric: "Home Value", value: Math.min(100, (selected.median_home_value_2023 / 420000) * 100) },
    { metric: "Rent Level", value: Math.min(100, (selected.median_rent_2023 / 1500) * 100) },
    { metric: "Ownership", value: selected.homeownership_rate_2023 ?? 0 },
    { metric: "Appreciation", value: Math.min(100, Math.max(0, (selected.home_value_5yr_change ?? 0) + 10) * 2) },
    { metric: "Affordability", value: Math.min(100, selected.affordability_index ?? 50) },
    { metric: "Income", value: Math.min(100, (selected.median_income_2023 / 100000) * 100) },
  ] : [];

  const BLUE = "oklch(0.45 0.18 255)";

  const cols: { key: SortKey; label: string }[] = [
    { key: "county_name", label: "County" },
    { key: "median_home_value_2023", label: "Home Value" },
    { key: "median_rent_2023", label: "Rent/Mo" },
    { key: "homeownership_rate_2023", label: "Ownership" },
    { key: "home_value_5yr_change", label: "5-Yr Change" },
    { key: "affordability_index", label: "Afford. Index" },
  ];

  return (
    <div className="p-6 flex gap-6 h-full">
      {/* Left: table */}
      <div className="flex-1 min-w-0 flex flex-col gap-4">
        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search counties..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 bg-white"
            />
          </div>
          <Select value={region} onValueChange={setRegion}>
            <SelectTrigger className="w-[160px] bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REGIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="text-sm text-muted-foreground flex items-center">
            {filtered.length} of 88 counties
          </div>
        </div>

        {/* Table */}
        <div className="chart-container overflow-hidden flex-1">
          <div className="overflow-auto h-full">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white z-10">
                <tr className="border-b" style={{ borderColor: "oklch(0.90 0.008 240)" }}>
                  {cols.map(col => (
                    <th
                      key={col.key}
                      className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground whitespace-nowrap cursor-pointer hover:text-foreground transition-colors select-none"
                      onClick={() => toggleSort(col.key)}
                    >
                      <span className="flex items-center gap-1">
                        {col.label} <SortIcon k={col.key} />
                      </span>
                    </th>
                  ))}
                  <th className="py-2.5 px-3 text-xs font-semibold text-muted-foreground">Region</th>
                  <th className="py-2.5 px-3 text-xs font-semibold text-muted-foreground">Market Type</th>
                  <th className="py-2.5 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const heat = heatData.find(h => h.county_fips === c.county_fips);
                  const cluster = clusterData.find(cl => cl.county_fips === c.county_fips);
                  const isSelected = selected?.county_fips === c.county_fips;
                  return (
                    <tr
                      key={c.county_fips}
                      className={`border-b cursor-pointer transition-colors ${isSelected ? "bg-accent" : "hover:bg-muted/40"}`}
                      style={{ borderColor: "oklch(0.93 0.005 240)" }}
                      onClick={() => setSelected(isSelected ? null : c)}
                    >
                      <td className="py-2 px-3 font-medium text-foreground">{c.county_name}</td>
                      <td className="py-2 px-3 data-value font-semibold">{fmtK(c.median_home_value_2023)}</td>
                      <td className="py-2 px-3 data-value">{fmtK(c.median_rent_2023)}</td>
                      <td className="py-2 px-3 data-value">{pct(c.homeownership_rate_2023)}</td>
                      <td className="py-2 px-3">
                        {c.home_value_5yr_change != null ? (
                          <span className={`data-value text-xs font-semibold ${c.home_value_5yr_change >= 0 ? "trend-up" : "trend-down"}`}>
                            {c.home_value_5yr_change >= 0 ? "+" : ""}{c.home_value_5yr_change.toFixed(1)}%
                          </span>
                        ) : "—"}
                      </td>
                      <td className="py-2 px-3">
                        {c.affordability_index != null ? (
                          <span className={`data-value text-xs font-semibold ${c.affordability_index >= 100 ? "trend-up" : c.affordability_index >= 80 ? "trend-neutral" : "trend-down"}`}>
                            {c.affordability_index.toFixed(0)}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="py-2 px-3 text-xs text-muted-foreground">{c.region ?? "—"}</td>
                      <td className="py-2 px-3">
                        {cluster?.cluster_label && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{
                            backgroundColor: cluster.cluster_label === "Affluent Suburban" ? "oklch(0.94 0.015 255)" : "oklch(0.96 0.005 240)",
                            color: cluster.cluster_label === "Affluent Suburban" ? "oklch(0.35 0.15 255)" : "oklch(0.42 0.02 240)",
                          }}>
                            {cluster.cluster_label}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${isSelected ? "rotate-90" : ""}`} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Right: detail panel */}
      {selected && (
        <div className="w-[320px] flex-shrink-0 space-y-4">
          <div className="chart-container">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-foreground">{selected.county_name}</h3>
              <button onClick={() => setSelected(null)} className="text-xs text-muted-foreground hover:text-foreground">✕</button>
            </div>
            <div className="space-y-2 text-sm">
              {[
                { label: "Median Home Value", value: fmtK(selected.median_home_value_2023) },
                { label: "Median Rent", value: fmtK(selected.median_rent_2023) + "/mo" },
                { label: "Median Income", value: fmtK(selected.median_income_2023) },
                { label: "Homeownership", value: pct(selected.homeownership_rate_2023) },
                { label: "Vacancy Rate", value: pct(selected.vacancy_rate_2023) },
                { label: "Population", value: selected.total_population_2023 ? selected.total_population_2023.toLocaleString() : "—" },
                { label: "5-Yr Appreciation", value: selected.home_value_5yr_change != null ? `${selected.home_value_5yr_change >= 0 ? "+" : ""}${selected.home_value_5yr_change.toFixed(1)}%` : "—" },
                { label: "Affordability Index", value: selected.affordability_index?.toFixed(0) ?? "—" },
              ].map(row => (
                <div key={row.label} className="flex justify-between items-center py-1 border-b" style={{ borderColor: "oklch(0.93 0.005 240)" }}>
                  <span className="text-muted-foreground text-xs">{row.label}</span>
                  <span className="data-value text-xs font-semibold text-foreground">{row.value}</span>
                </div>
              ))}
            </div>
            {selectedCluster && (
              <div className="mt-3 pt-3 border-t" style={{ borderColor: "oklch(0.93 0.005 240)" }}>
                <div className="text-xs text-muted-foreground mb-1">Market Archetype</div>
                <span className="text-sm font-semibold" style={{ color: "oklch(0.45 0.18 255)" }}>
                  {selectedCluster.cluster_label}
                </span>
              </div>
            )}
          </div>

          {/* Radar chart */}
          <div className="chart-container">
            <h4 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">County Profile</h4>
            <ResponsiveContainer width="100%" height={200}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="oklch(0.90 0.008 240)" />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10 }} />
                <Radar dataKey="value" stroke={BLUE} fill={BLUE} fillOpacity={0.2} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Metro area */}
          {selected.metro_area && (
            <div className="chart-container">
              <div className="text-xs text-muted-foreground mb-1">Metro Area</div>
              <div className="text-sm font-semibold text-foreground">{selected.metro_area}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
