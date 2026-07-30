/*
 * County Explorer — Data Terminal style
 * Sortable table of all 88 Ohio counties with detail panel
 * Dense, monospace numbers, source citations
 */

import { useState, useMemo } from "react";
import { Search, ArrowUpDown, ArrowUp, ArrowDown, ExternalLink } from "lucide-react";
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

const C1 = "oklch(0.38 0.12 250)";
const C3 = "oklch(0.48 0.16 145)";
const C4 = "oklch(0.55 0.20 25)";
const CHART_STYLE = { fontSize: 10, fontFamily: "'IBM Plex Mono', monospace" };

function fmtK(n: number | null | undefined) {
  if (n == null) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}
function pct(n: number | null | undefined, dec = 1) {
  if (n == null) return "—";
  return `${n.toFixed(dec)}%`;
}

type SortKey = "county_name" | "median_home_value_2023" | "median_rent_2023" | "homeownership_rate_2023" | "home_value_5yr_change" | "affordability_index" | "median_income_2023";
const REGIONS = ["All Regions", "Central", "Northeast", "Southwest", "Northwest", "Southeast"];

// Statewide maxima for radar normalization, derived from the data so the
// scale stays correct when the pipeline refreshes.
const maxOf = (key: string) =>
  Math.max(...counties.map(c => c[key] ?? 0).filter((v: number) => Number.isFinite(v)), 1);
const MAX_HOME_VALUE = maxOf("median_home_value_2023");
const MAX_RENT = maxOf("median_rent_2023");
const MAX_INCOME = maxOf("median_income_2023");

const COLS: { key: SortKey; label: string; width?: string }[] = [
  { key: "county_name", label: "County" },
  { key: "median_home_value_2023", label: "Home Value" },
  { key: "median_rent_2023", label: "Rent/Mo" },
  { key: "median_income_2023", label: "Med. Income" },
  { key: "homeownership_rate_2023", label: "Ownership" },
  { key: "home_value_5yr_change", label: "5-Yr Chg" },
  { key: "affordability_index", label: "Afford. Idx" },
];

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
    if (sortKey !== k) return <ArrowUpDown className="w-2.5 h-2.5 inline opacity-30 ml-0.5" />;
    return sortDir === "asc"
      ? <ArrowUp className="w-2.5 h-2.5 inline ml-0.5" />
      : <ArrowDown className="w-2.5 h-2.5 inline ml-0.5" />;
  }

  const selectedCluster = selected ? clusterData.find(c => c.county_fips === selected.county_fips) : null;

  const radarData = selected ? [
    { metric: "Value", value: Math.min(100, (selected.median_home_value_2023 / MAX_HOME_VALUE) * 100) },
    { metric: "Rent", value: Math.min(100, (selected.median_rent_2023 / MAX_RENT) * 100) },
    { metric: "Ownership", value: selected.homeownership_rate_2023 ?? 0 },
    { metric: "Appreciation", value: Math.min(100, Math.max(0, (selected.home_value_5yr_change ?? 0) + 10) * 2) },
    { metric: "Affordability", value: Math.min(100, selected.affordability_index ?? 50) },
    { metric: "Income", value: Math.min(100, (selected.median_income_2023 / MAX_INCOME) * 100) },
  ] : [];

  return (
    <div className="p-4 flex gap-4 h-full overflow-hidden">

      {/* Main table */}
      <div className="flex-1 min-w-0 flex flex-col gap-3 overflow-hidden">

        {/* Filters */}
        <div className="panel">
          <div className="px-3 py-2 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Search counties..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 h-7 text-xs bg-white"
              />
            </div>
            <Select value={region} onValueChange={setRegion}>
              <SelectTrigger className="w-[150px] h-7 text-xs bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REGIONS.map(r => <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>)}
              </SelectContent>
            </Select>
            <span className="source-tag">{filtered.length} / 88 counties</span>
            <span className="source-tag">
              <a href="https://data.census.gov" target="_blank" rel="noopener noreferrer" className="flex items-center gap-0.5 hover:underline">
                US Census ACS 2023 <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </span>
          </div>
        </div>

        {/* Table */}
        <div className="panel flex-1 overflow-hidden">
          <div className="overflow-auto h-full">
            <table className="data-table">
              <thead className="sticky top-0 z-10" style={{ background: "oklch(0.97 0.002 240)" }}>
                <tr>
                  <th className="w-6 text-center">#</th>
                  {COLS.map(col => (
                    <th
                      key={col.key}
                      className="cursor-pointer select-none hover:text-foreground transition-colors"
                      onClick={() => toggleSort(col.key)}
                    >
                      {col.label}<SortIcon k={col.key} />
                    </th>
                  ))}
                  <th>Region</th>
                  <th>Cluster</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => {
                  const cluster = clusterData.find(cl => cl.county_fips === c.county_fips);
                  const isSelected = selected?.county_fips === c.county_fips;
                  return (
                    <tr
                      key={c.county_fips}
                      className="cursor-pointer transition-colors"
                      style={{ background: isSelected ? "oklch(0.94 0.015 255)" : undefined }}
                      onClick={() => setSelected(isSelected ? null : c)}
                      onMouseEnter={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "oklch(0.96 0.003 240)"; }}
                      onMouseLeave={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = ""; }}
                    >
                      <td className="mono text-center" style={{ color: "var(--muted-foreground)" }}>{i + 1}</td>
                      <td style={{ fontWeight: 500 }}>{c.county_name}</td>
                      <td className="mono">{fmtK(c.median_home_value_2023)}</td>
                      <td className="mono">{fmtK(c.median_rent_2023)}</td>
                      <td className="mono">{fmtK(c.median_income_2023)}</td>
                      <td className="mono">{pct(c.homeownership_rate_2023)}</td>
                      <td>
                        {c.home_value_5yr_change != null ? (
                          <span className={`mono text-xs font-semibold ${c.home_value_5yr_change >= 0 ? "trend-up" : "trend-down"}`}>
                            {c.home_value_5yr_change >= 0 ? "+" : ""}{c.home_value_5yr_change.toFixed(1)}%
                          </span>
                        ) : "—"}
                      </td>
                      <td>
                        {c.affordability_index != null ? (
                          <span className={`mono text-xs font-semibold ${c.affordability_index >= 100 ? "trend-up" : c.affordability_index >= 80 ? "" : "trend-down"}`}>
                            {c.affordability_index.toFixed(0)}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="source-tag">{c.region ?? "—"}</td>
                      <td>
                        {cluster?.cluster_label && (
                          <span className="source-tag" style={{ fontSize: 10 }}>{cluster.cluster_label}</span>
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

      {/* Detail panel */}
      {selected && (
        <div className="w-[300px] flex-shrink-0 space-y-3 overflow-y-auto">
          <div className="panel">
            <div className="section-header">
              <span className="section-title">{selected.county_name}</span>
              <button onClick={() => setSelected(null)} className="source-tag hover:text-foreground">✕</button>
            </div>
            <div className="px-3 py-1">
              {[
                { label: "Median Home Value", val: fmtK(selected.median_home_value_2023), note: "ACS B25077" },
                { label: "Median Gross Rent", val: fmtK(selected.median_rent_2023) + "/mo", note: "ACS B25064" },
                { label: "Median Income", val: fmtK(selected.median_income_2023), note: "ACS B19013" },
                { label: "Homeownership", val: pct(selected.homeownership_rate_2023), note: "ACS B25003" },
                { label: "Vacancy Rate", val: pct(selected.vacancy_rate_2023), note: "ACS B25002" },
                { label: "Population", val: selected.total_population_2023?.toLocaleString() ?? "—", note: "ACS B01003" },
                { label: "5-Yr Appreciation", val: selected.home_value_5yr_change != null ? `${selected.home_value_5yr_change >= 0 ? "+" : ""}${selected.home_value_5yr_change.toFixed(1)}%` : "—", note: "2019→2023" },
                { label: "Affordability Index", val: selected.affordability_index?.toFixed(0) ?? "—", note: "5×income/value×100" },
              ].map(row => (
                <div key={row.label} className="stat-row">
                  <div>
                    <div className="label">{row.label}</div>
                    <div className="source-tag">{row.note}</div>
                  </div>
                  <span className="val">{row.val}</span>
                </div>
              ))}
              {selectedCluster && (
                <div className="stat-row">
                  <span className="label">Market Cluster</span>
                  <span className="val text-xs" style={{ color: C1 }}>{selectedCluster.cluster_label}</span>
                </div>
              )}
              {selected.metro_area && (
                <div className="stat-row">
                  <span className="label">Metro Area</span>
                  <span className="val text-xs">{selected.metro_area}</span>
                </div>
              )}
            </div>
          </div>

          {/* Radar */}
          <div className="panel">
            <div className="section-header">
              <span className="section-title">County Profile</span>
              <span className="source-tag">normalized 0–100</span>
            </div>
            <div className="p-2">
              <ResponsiveContainer width="100%" height={180}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="oklch(0.90 0.004 240)" />
                  <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace" }} />
                  <Radar dataKey="value" stroke={C1} fill={C1} fillOpacity={0.15} strokeWidth={1.5} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
