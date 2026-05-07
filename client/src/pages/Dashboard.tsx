/*
 * Dashboard — Data Terminal style
 * Dense stat grid, tight tables, monospace numbers, source citations on every chart
 * No hero images, no gradient overlays, no decorative chrome
 */

import { useMemo } from "react";
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { ArrowUpRight, ArrowDownRight, ExternalLink } from "lucide-react";
import { useLiveData } from "@/hooks/useLiveData";
import kpisData from "@/data/kpis.json";
import countySummary from "@/data/county_summary.json";
import economicData from "@/data/economic_indicators.json";
import hpiForecast from "@/data/hpi_forecast.json";

const kpis = kpisData as any;
const counties = countySummary as any[];
const economic = economicData as any[];
const forecast = hpiForecast as any[];

const C1 = "oklch(0.38 0.12 250)";
const C2 = "oklch(0.52 0.14 220)";
const C3 = "oklch(0.48 0.16 145)";
const C4 = "oklch(0.55 0.20 25)";
const C5 = "oklch(0.62 0.18 75)";

function fmt(n: number | null | undefined, pre = "", suf = "", dec = 0) {
  if (n == null) return "—";
  return `${pre}${n.toLocaleString("en-US", { maximumFractionDigits: dec })}${suf}`;
}
function fmtK(n: number | null | undefined) {
  if (n == null) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

function Delta({ v, suf = "%" }: { v: number | null | undefined; suf?: string }) {
  if (v == null) return <span className="source-tag">—</span>;
  const up = v >= 0;
  return (
    <span className={`data-value text-xs font-semibold ${up ? "trend-up" : "trend-down"}`}>
      {up ? <ArrowUpRight className="w-3 h-3 inline" /> : <ArrowDownRight className="w-3 h-3 inline" />}
      {Math.abs(v).toFixed(1)}{suf}
    </span>
  );
}

function SectionHeader({ title, source, url }: { title: string; source: string; url?: string }) {
  return (
    <div className="section-header">
      <span className="section-title">{title}</span>
      <span className="source-tag flex items-center gap-1">
        {url ? (
          <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-0.5 hover:underline">
            {source} <ExternalLink className="w-2.5 h-2.5" />
          </a>
        ) : source}
      </span>
    </div>
  );
}

const CHART_STYLE = {
  fontSize: 10,
  fontFamily: "'IBM Plex Mono', monospace",
};

export default function Dashboard() {
  const live = useLiveData();

  const hpiData = useMemo(() => {
    const series = economic.filter(d => d.friendly_name === "ohio_hpi_all_transactions" && d.date >= "2015-01-01");
    const forecastMap = new Map(forecast.map(d => [d.date?.substring(0, 7), d]));
    const lastActualDate = series[series.length - 1]?.date;
    const futureForecast = forecast.filter(d => d.date > (lastActualDate ?? "")).slice(0, 8);
    return [
      ...series.map(d => ({ date: d.date?.substring(0, 7), actual: d.value, forecast: null as number | null, upper: null as number | null, lower: null as number | null })),
      ...futureForecast.map(d => ({ date: d.date?.substring(0, 7), actual: null, forecast: d.hpi_forecast, upper: d.hpi_upper, lower: d.hpi_lower })),
    ];
  }, []);

  const mortgageData = useMemo(() =>
    economic.filter(d => d.friendly_name === "mortgage_rate_30yr_fixed" && d.date >= "2019-01-01")
      .map(d => ({ date: d.date?.substring(0, 7), rate: d.value }))
      .filter((d, i, a) => i === a.findIndex(x => x.date === d.date)),
    []
  );

  const listingData = useMemo(() =>
    economic.filter(d => d.friendly_name === "ohio_median_listing_price" && d.date >= "2019-01-01")
      .map(d => ({ date: d.date?.substring(0, 7), price: d.value })),
    []
  );

  const inventoryData = useMemo(() =>
    economic.filter(d => d.friendly_name === "ohio_active_listing_count" && d.date >= "2019-01-01")
      .map(d => ({ date: d.date?.substring(0, 7), count: d.value })),
    []
  );

  const top10 = useMemo(() =>
    [...counties].filter(c => c.median_home_value_2023).sort((a, b) => b.median_home_value_2023 - a.median_home_value_2023).slice(0, 10),
    []
  );

  const sw = kpis.statewide ?? {};

  // Statewide summary stats
  const STATS = [
    { label: "Avg. Median Home Value", val: fmtK(sw.avg_home_value), note: "2023 ACS 5-yr" },
    { label: "Avg. Gross Rent", val: fmtK(sw.avg_rent) + "/mo", note: "2023 ACS 5-yr" },
    { label: "Avg. Homeownership Rate", val: fmt(sw.avg_homeownership_rate, "", "%", 1), note: "2023 ACS 5-yr" },
    { label: "Avg. Vacancy Rate", val: fmt(sw.avg_vacancy_rate, "", "%", 1), note: "2023 ACS 5-yr" },
    { label: "Total Population", val: fmt(sw.total_population ? sw.total_population / 1_000_000 : null, "", "M", 2), note: "2023 ACS 5-yr" },
    { label: "5-Yr Home Value Appreciation", val: fmt(sw.avg_5yr_appreciation_pct, "", "%", 1), note: "2019→2023" },
    { label: "Median Listing Price", val: fmtK(live.ohio_listing_price.value), note: live.ohio_listing_price.source === "live" ? `FRED · ${live.ohio_listing_price.date}` : "FRED · cached" },
    { label: "30-Yr Mortgage Rate", val: fmt(live.mortgage_rate_30yr.value, "", "%", 2), note: live.mortgage_rate_30yr.source === "live" ? `FRED · ${live.mortgage_rate_30yr.date}` : "FRED · cached" },
    { label: "Ohio Unemployment Rate", val: fmt(live.ohio_unemployment.value, "", "%", 1), note: live.ohio_unemployment.source === "live" ? `BLS via FRED · ${live.ohio_unemployment.date}` : "BLS via FRED · cached" },
    { label: "Ohio HPI (FHFA)", val: fmt(live.ohio_hpi.value, "", "", 1), note: live.ohio_hpi.source === "live" ? `FHFA via FRED · ${live.ohio_hpi.date}` : "FHFA via FRED · cached" },
    { label: "Federal Funds Rate", val: fmt(live.fed_funds_rate.value, "", "%", 2), note: live.fed_funds_rate.source === "live" ? `FRED · ${live.fed_funds_rate.date}` : "FRED · cached" },
    { label: "Counties Analyzed", val: "88", note: "All Ohio counties" },
  ];

  return (
    <div className="p-4 space-y-4">

      {/* ── Top row: stat table + HPI chart ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Stat table */}
        <div className="panel">
          <SectionHeader title="Ohio Statewide Summary" source="Census ACS + FRED" url="https://fred.stlouisfed.org/tags/series?t=housing%3Boh" />
          <div className="px-3 py-1">
            {STATS.map(s => (
              <div key={s.label} className="stat-row">
                <span className="label">{s.label}</span>
                <div className="text-right">
                  <span className="val">{s.val}</span>
                  <div className="source-tag">{s.note}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* HPI + forecast */}
        <div className="panel lg:col-span-2">
          <SectionHeader title="Ohio House Price Index — Actual + Prophet Forecast" source="FHFA via FRED · OHSTHPI" url="https://fred.stlouisfed.org/series/OHSTHPI" />
          <div className="p-3">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={hpiData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="hpiG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C1} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={C1} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="fcstG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C5} stopOpacity={0.12} />
                    <stop offset="95%" stopColor={C5} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" stroke="oklch(0.90 0.004 240)" />
                <XAxis dataKey="date" tick={CHART_STYLE} tickLine={false} axisLine={false} interval={7} />
                <YAxis tick={CHART_STYLE} tickLine={false} axisLine={false} width={42} />
                <Tooltip
                  contentStyle={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", borderRadius: 2, border: "1px solid var(--border)" }}
                  formatter={(v: any, name: string) => [v?.toFixed ? v.toFixed(1) : v, name]}
                />
                <Area type="monotone" dataKey="actual" stroke={C1} fill="url(#hpiG)" strokeWidth={1.5} dot={false} name="HPI (actual)" connectNulls={false} />
                <Area type="monotone" dataKey="forecast" stroke={C5} fill="url(#fcstG)" strokeWidth={1.5} strokeDasharray="4 2" dot={false} name="HPI (forecast)" connectNulls={false} />
              </AreaChart>
            </ResponsiveContainer>
            <div className="source-tag mt-1">
              Forecast: Facebook Prophet with mortgage rate, unemployment, and fed funds rate as regressors · 8-quarter horizon · 95% CI
            </div>
          </div>
        </div>
      </div>

      {/* ── Second row: mortgage + listing price + inventory ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="panel">
          <SectionHeader title="30-Yr Fixed Mortgage Rate" source="Freddie Mac via FRED" url="https://fred.stlouisfed.org/series/MORTGAGE30US" />
          <div className="p-3">
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={mortgageData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="oklch(0.90 0.004 240)" />
                <XAxis dataKey="date" tick={CHART_STYLE} tickLine={false} axisLine={false} interval={8} />
                <YAxis tick={CHART_STYLE} tickLine={false} axisLine={false} width={35} tickFormatter={v => `${v}%`} domain={["auto", "auto"]} />
                <Tooltip contentStyle={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", borderRadius: 2 }} formatter={(v: any) => [`${Number(v).toFixed(2)}%`, "Rate"]} />
                <ReferenceLine y={7} stroke={C4} strokeDasharray="3 3" strokeWidth={1} />
                <Line type="monotone" dataKey="rate" stroke={C4} strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
            <div className="source-tag mt-1">Weekly · MORTGAGE30US · Reference line: 7%</div>
          </div>
        </div>

        <div className="panel">
          <SectionHeader title="Ohio Median Listing Price" source="Realtor.com via FRED" url="https://fred.stlouisfed.org/series/MEDLISPRIOH" />
          <div className="p-3">
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={listingData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="listG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C3} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={C3} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" stroke="oklch(0.90 0.004 240)" />
                <XAxis dataKey="date" tick={CHART_STYLE} tickLine={false} axisLine={false} interval={6} />
                <YAxis tick={CHART_STYLE} tickLine={false} axisLine={false} width={48} tickFormatter={v => `$${(v/1000).toFixed(0)}K`} />
                <Tooltip contentStyle={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", borderRadius: 2 }} formatter={(v: any) => [`$${Number(v).toLocaleString()}`, "Listing Price"]} />
                <Area type="monotone" dataKey="price" stroke={C3} fill="url(#listG)" strokeWidth={1.5} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
            <div className="source-tag mt-1">Monthly · MEDLISPRIOH</div>
          </div>
        </div>

        <div className="panel">
          <SectionHeader title="Ohio Active Listing Count" source="Realtor.com via FRED" url="https://fred.stlouisfed.org/series/ACTLISCOUOH" />
          <div className="p-3">
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={inventoryData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="invG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C2} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={C2} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" stroke="oklch(0.90 0.004 240)" />
                <XAxis dataKey="date" tick={CHART_STYLE} tickLine={false} axisLine={false} interval={6} />
                <YAxis tick={CHART_STYLE} tickLine={false} axisLine={false} width={42} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
                <Tooltip contentStyle={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", borderRadius: 2 }} formatter={(v: any) => [Number(v).toLocaleString(), "Active Listings"]} />
                <Area type="monotone" dataKey="count" stroke={C2} fill="url(#invG)" strokeWidth={1.5} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
            <div className="source-tag mt-1">Monthly · ACTLISCOUOH</div>
          </div>
        </div>
      </div>

      {/* ── County table ── */}
      <div className="panel">
        <SectionHeader
          title={`County Rankings — All 88 Ohio Counties (2023 ACS 5-Year Estimates)`}
          source="US Census Bureau · ACS B25077, B25064, B25003, B19013"
          url="https://data.census.gov"
        />
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>County</th>
                <th>Region</th>
                <th>Median Home Value</th>
                <th>Median Rent</th>
                <th>Median Income</th>
                <th>Homeownership</th>
                <th>Vacancy</th>
                <th>5-Yr Change</th>
                <th>Afford. Index</th>
              </tr>
            </thead>
            <tbody>
              {[...counties]
                .sort((a, b) => (b.median_home_value_2023 ?? 0) - (a.median_home_value_2023 ?? 0))
                .map((c, i) => (
                  <tr key={c.county_fips}>
                    <td className="mono" style={{ color: "var(--muted-foreground)" }}>{i + 1}</td>
                    <td style={{ fontWeight: 500 }}>{c.county_name}</td>
                    <td className="source-tag">{c.region ?? "—"}</td>
                    <td className="mono">{fmtK(c.median_home_value_2023)}</td>
                    <td className="mono">{fmtK(c.median_rent_2023)}/mo</td>
                    <td className="mono">{fmtK(c.median_income_2023)}</td>
                    <td className="mono">{c.homeownership_rate_2023 != null ? `${c.homeownership_rate_2023.toFixed(1)}%` : "—"}</td>
                    <td className="mono">{c.vacancy_rate_2023 != null ? `${c.vacancy_rate_2023.toFixed(1)}%` : "—"}</td>
                    <td><Delta v={c.home_value_5yr_change} /></td>
                    <td>
                      <span className={`mono text-xs font-semibold ${c.affordability_index >= 100 ? "trend-up" : c.affordability_index >= 80 ? "" : "trend-down"}`}>
                        {c.affordability_index?.toFixed(0) ?? "—"}
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <div className="px-3 py-2 source-tag" style={{ borderTop: "1px solid var(--border)" }}>
          Affordability Index = (5 × Median Income) / Median Home Value × 100. Index ≥ 100 indicates median income can support a conventional mortgage on the median home.
          Source: US Census Bureau American Community Survey 5-Year Estimates, Table B25077 (median home value), B25064 (gross rent), B19013 (median household income).
        </div>
      </div>

      {/* ── Top 10 bar chart ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="panel">
          <SectionHeader title="Top 10 Counties by Median Home Value (2023)" source="ACS B25077" url="https://data.census.gov" />
          <div className="p-3">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={top10} layout="vertical" margin={{ top: 0, right: 8, left: 90, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="oklch(0.90 0.004 240)" horizontal={false} />
                <XAxis type="number" tick={CHART_STYLE} tickLine={false} axisLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}K`} />
                <YAxis type="category" dataKey="county_name" tick={{ ...CHART_STYLE, fontSize: 10 }} tickLine={false} axisLine={false} width={90} />
                <Tooltip contentStyle={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", borderRadius: 2 }} formatter={(v: any) => [`$${Number(v).toLocaleString()}`, "Median Value"]} />
                <Bar dataKey="median_home_value_2023" fill={C1} radius={[0, 2, 2, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel">
          <SectionHeader title="Top 10 Counties by 5-Year Appreciation (2019→2023)" source="ACS B25077" url="https://data.census.gov" />
          <div className="p-3">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={[...counties].filter(c => c.home_value_5yr_change != null).sort((a, b) => b.home_value_5yr_change - a.home_value_5yr_change).slice(0, 10)}
                layout="vertical"
                margin={{ top: 0, right: 8, left: 90, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="2 4" stroke="oklch(0.90 0.004 240)" horizontal={false} />
                <XAxis type="number" tick={CHART_STYLE} tickLine={false} axisLine={false} tickFormatter={v => `${v.toFixed(0)}%`} />
                <YAxis type="category" dataKey="county_name" tick={{ ...CHART_STYLE, fontSize: 10 }} tickLine={false} axisLine={false} width={90} />
                <Tooltip contentStyle={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", borderRadius: 2 }} formatter={(v: any) => [`${Number(v).toFixed(1)}%`, "5-Yr Change"]} />
                <Bar dataKey="home_value_5yr_change" fill={C3} radius={[0, 2, 2, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

    </div>
  );
}
