/*
 * Market Trends — Data Terminal style
 * Redfin market tracker data: no banner images, dense charts with source citations
 */

import { useState, useMemo } from "react";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  ReferenceLine,
} from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExternalLink } from "lucide-react";
import redfin from "@/data/redfin_county_market.json";

const redfinData = redfin as any[];

const OHIO_COUNTIES = Array.from(new Set(redfinData.map(d => d.region))).sort() as string[];

const C1 = "oklch(0.38 0.12 250)";
const C2 = "oklch(0.52 0.14 220)";
const C3 = "oklch(0.48 0.16 145)";
const C4 = "oklch(0.55 0.20 25)";
const C5 = "oklch(0.62 0.18 75)";

const CHART_STYLE = { fontSize: 10, fontFamily: "'IBM Plex Mono', monospace" };

function fmtK(n: number | null | undefined) {
  if (n == null) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
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

export default function MarketTrends() {
  const [county1, setCounty1] = useState("Franklin County");
  const [county2, setCounty2] = useState("Cuyahoga County");
  const [metric, setMetric] = useState("median_sale_price");

  const METRICS = [
    { key: "median_sale_price",      label: "Median Sale Price",    fmt: fmtK },
    { key: "median_list_price",      label: "Median List Price",    fmt: fmtK },
    { key: "median_ppsf",            label: "Price / Sq Ft",        fmt: (v: any) => v ? `$${Number(v).toFixed(0)}` : "—" },
    { key: "homes_sold",             label: "Homes Sold",           fmt: (v: any) => v ? Number(v).toFixed(0) : "—" },
    { key: "inventory",              label: "Active Inventory",     fmt: (v: any) => v ? Number(v).toFixed(0) : "—" },
    { key: "months_of_supply",       label: "Months of Supply",     fmt: (v: any) => v ? Number(v).toFixed(1) : "—" },
    { key: "median_dom",             label: "Days on Market",       fmt: (v: any) => v ? Number(v).toFixed(0) : "—" },
    { key: "avg_sale_to_list",       label: "Sale-to-List Ratio",   fmt: (v: any) => v ? `${(Number(v) * 100).toFixed(1)}%` : "—" },
    { key: "sold_above_list",        label: "Sold Above List %",    fmt: (v: any) => v ? `${(Number(v) * 100).toFixed(1)}%` : "—" },
    { key: "price_drops",            label: "Price Drop %",         fmt: (v: any) => v ? `${(Number(v) * 100).toFixed(1)}%` : "—" },
  ];

  const selectedMetric = METRICS.find(m => m.key === metric) ?? METRICS[0];

  // County comparison data
  const comparisonData = useMemo(() => {
    const c1 = redfinData.filter(d => d.region === county1).sort((a, b) => a.period_begin.localeCompare(b.period_begin));
    const c2 = redfinData.filter(d => d.region === county2).sort((a, b) => a.period_begin.localeCompare(b.period_begin));
    const dates = Array.from(new Set([...c1.map(d => d.period_begin), ...c2.map(d => d.period_begin)])).sort();
    const c1Map: Record<string, any> = {};
    const c2Map: Record<string, any> = {};
    c1.forEach(d => { c1Map[d.period_begin] = d; });
    c2.forEach(d => { c2Map[d.period_begin] = d; });
    return dates.map(date => ({
      date: date?.substring(0, 7),
      [county1]: c1Map[date]?.[metric] ?? null,
      [county2]: c2Map[date]?.[metric] ?? null,
    }));
  }, [county1, county2, metric]);

  // Statewide aggregated
  const statewideTrend = useMemo(() => {
    const byDate: Record<string, { prices: number[]; dom: number[]; inventory: number[]; sold: number[]; s2l: number[] }> = {};
    redfinData.forEach(d => {
      const date = d.period_begin?.substring(0, 7);
      if (!date) return;
      if (!byDate[date]) byDate[date] = { prices: [], dom: [], inventory: [], sold: [], s2l: [] };
      if (d.median_sale_price) byDate[date].prices.push(d.median_sale_price);
      if (d.median_dom) byDate[date].dom.push(d.median_dom);
      if (d.inventory) byDate[date].inventory.push(d.inventory);
      if (d.homes_sold) byDate[date].sold.push(d.homes_sold);
      if (d.avg_sale_to_list) byDate[date].s2l.push(d.avg_sale_to_list);
    });
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({
        date,
        avg_price: v.prices.length ? v.prices.reduce((a, b) => a + b, 0) / v.prices.length : null,
        avg_dom: v.dom.length ? v.dom.reduce((a, b) => a + b, 0) / v.dom.length : null,
        total_sold: v.sold.length ? v.sold.reduce((a, b) => a + b, 0) : null,
        avg_s2l: v.s2l.length ? (v.s2l.reduce((a, b) => a + b, 0) / v.s2l.length) * 100 : null,
      }));
  }, []);

  // Top appreciation
  const topAppreciation = useMemo(() => {
    const latest = new Map<string, any>();
    const oldest = new Map<string, any>();
    redfinData.forEach(d => {
      if (!d.region || !d.median_sale_price) return;
      const ex = latest.get(d.region);
      if (!ex || d.period_begin > ex.period_begin) latest.set(d.region, d);
      const old = oldest.get(d.region);
      if (!old || d.period_begin < old.period_begin) oldest.set(d.region, d);
    });
    const result: any[] = [];
    latest.forEach((l, region) => {
      const o = oldest.get(region);
      if (o && o.median_sale_price && l.median_sale_price) {
        const change = (l.median_sale_price - o.median_sale_price) / o.median_sale_price * 100;
        result.push({ region, latest_price: l.median_sale_price, change });
      }
    });
    return result.sort((a, b) => b.change - a.change).slice(0, 10);
  }, []);

  // Latest snapshot per county (for table)
  const latestByCounty = useMemo(() => {
    const latest = new Map<string, any>();
    redfinData.forEach(d => {
      const ex = latest.get(d.region);
      if (!ex || d.period_begin > ex.period_begin) latest.set(d.region, d);
    });
    return Array.from(latest.values()).sort((a, b) => (b.median_sale_price ?? 0) - (a.median_sale_price ?? 0));
  }, []);

  return (
    <div className="p-4 space-y-4">

      {/* Data info bar — replaces banner */}
      <div className="panel">
        <div className="px-4 py-3 flex flex-wrap items-center gap-6 text-xs">
          <div>
            <span className="section-title">REDFIN MARKET TRACKER</span>
            <span className="source-tag ml-2">
              <a href="https://www.redfin.com/news/data-center/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-0.5 hover:underline inline-flex">
                redfin.com/news/data-center <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </span>
          </div>
          {[
            { label: "COUNTIES", val: "88" },
            { label: "DATE RANGE", val: "Jan 2012 – Mar 2026" },
            { label: "FREQUENCY", val: "Monthly" },
            { label: "RECORDS", val: "48,172" },
            { label: "PROPERTY TYPE", val: "All Residential" },
          ].map(s => (
            <div key={s.label} className="flex flex-col">
              <span className="source-tag">{s.label}</span>
              <span className="data-value text-xs font-semibold text-foreground">{s.val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Statewide trends row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="panel">
          <SectionHeader title="Statewide Avg. Median Sale Price" source="Redfin · median_sale_price" url="https://www.redfin.com/news/data-center/" />
          <div className="p-3">
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={statewideTrend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="priceG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C1} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={C1} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" stroke="oklch(0.90 0.004 240)" />
                <XAxis dataKey="date" tick={CHART_STYLE} tickLine={false} axisLine={false} minTickGap={60} />
                <YAxis tick={CHART_STYLE} tickLine={false} axisLine={false} width={52} tickFormatter={v => `$${(v/1000).toFixed(0)}K`} />
                <Tooltip contentStyle={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", borderRadius: 2 }} formatter={(v: any) => [`$${Number(v).toLocaleString()}`, "Avg Sale Price"]} />
                <Area type="monotone" dataKey="avg_price" stroke={C1} fill="url(#priceG)" strokeWidth={1.5} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
            <div className="source-tag mt-1">Average of all 88 Ohio counties reporting · All Residential property type</div>
          </div>
        </div>

        <div className="panel">
          <SectionHeader title="Statewide Avg. Days on Market" source="Redfin · median_dom" />
          <div className="p-3">
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={statewideTrend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="oklch(0.90 0.004 240)" />
                <XAxis dataKey="date" tick={CHART_STYLE} tickLine={false} axisLine={false} minTickGap={60} />
                <YAxis tick={CHART_STYLE} tickLine={false} axisLine={false} width={30} />
                <Tooltip contentStyle={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", borderRadius: 2 }} formatter={(v: any) => [`${Number(v).toFixed(1)} days`, "Avg DOM"]} />
                <ReferenceLine y={30} stroke={C4} strokeDasharray="3 3" strokeWidth={1} label={{ value: "30d", position: "right", fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", fill: C4 }} />
                <Line type="monotone" dataKey="avg_dom" stroke={C5} strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
            <div className="source-tag mt-1">Lower = faster market. Reference: 30-day threshold</div>
          </div>
        </div>
      </div>

      {/* Sale-to-list + homes sold */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="panel">
          <SectionHeader title="Avg. Sale-to-List Ratio" source="Redfin · avg_sale_to_list" />
          <div className="p-3">
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={statewideTrend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="oklch(0.90 0.004 240)" />
                <XAxis dataKey="date" tick={CHART_STYLE} tickLine={false} axisLine={false} minTickGap={60} />
                <YAxis tick={CHART_STYLE} tickLine={false} axisLine={false} width={40} tickFormatter={v => `${v.toFixed(0)}%`} domain={["auto", "auto"]} />
                <Tooltip contentStyle={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", borderRadius: 2 }} formatter={(v: any) => [`${Number(v).toFixed(2)}%`, "Sale/List"]} />
                <ReferenceLine y={100} stroke={C4} strokeDasharray="3 3" strokeWidth={1} />
                <Line type="monotone" dataKey="avg_s2l" stroke={C3} strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
            <div className="source-tag mt-1">Above 100% = overbid market. Reference: 100% parity line</div>
          </div>
        </div>

        <div className="panel">
          <SectionHeader title="Total Homes Sold (Statewide)" source="Redfin · homes_sold" />
          <div className="p-3">
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={statewideTrend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="soldG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C2} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={C2} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" stroke="oklch(0.90 0.004 240)" />
                <XAxis dataKey="date" tick={CHART_STYLE} tickLine={false} axisLine={false} minTickGap={60} />
                <YAxis tick={CHART_STYLE} tickLine={false} axisLine={false} width={40} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
                <Tooltip contentStyle={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", borderRadius: 2 }} formatter={(v: any) => [Number(v).toLocaleString(), "Homes Sold"]} />
                <Area type="monotone" dataKey="total_sold" stroke={C2} fill="url(#soldG)" strokeWidth={1.5} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
            <div className="source-tag mt-1">Sum across all Ohio counties reporting</div>
          </div>
        </div>
      </div>

      {/* County comparison */}
      <div className="panel">
        <SectionHeader title="County vs. County Comparison" source="Redfin Market Tracker" url="https://www.redfin.com/news/data-center/" />
        <div className="px-3 py-2 flex flex-wrap gap-2" style={{ borderBottom: "1px solid var(--border)" }}>
          <Select value={county1} onValueChange={setCounty1}>
            <SelectTrigger className="w-[180px] h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OHIO_COUNTIES.map(c => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="text-xs self-center text-muted-foreground">vs.</span>
          <Select value={county2} onValueChange={setCounty2}>
            <SelectTrigger className="w-[180px] h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OHIO_COUNTIES.map(c => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={metric} onValueChange={setMetric}>
            <SelectTrigger className="w-[200px] h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {METRICS.map(m => <SelectItem key={m.key} value={m.key} className="text-xs">{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="p-3">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={comparisonData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="oklch(0.90 0.004 240)" />
              <XAxis dataKey="date" tick={CHART_STYLE} tickLine={false} axisLine={false} minTickGap={60} />
              <YAxis
                tick={CHART_STYLE} tickLine={false} axisLine={false} width={55}
                tickFormatter={(v) => metric.includes("price") || metric.includes("ppsf") ? `$${(v/1000).toFixed(0)}K` : String(v)}
              />
              <Tooltip
                contentStyle={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", borderRadius: 2 }}
                formatter={(v: any, name: string) => [selectedMetric.fmt(v), name]}
              />
              <Legend wrapperStyle={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace" }} />
              <Line type="monotone" dataKey={county1} stroke={C1} strokeWidth={1.5} dot={false} connectNulls />
              <Line type="monotone" dataKey={county2} stroke={C4} strokeWidth={1.5} dot={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top appreciation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="panel">
          <SectionHeader title="Top 10 Counties — Price Appreciation (2012→2026)" source="Redfin · median_sale_price" />
          <div className="p-3">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topAppreciation} layout="vertical" margin={{ top: 0, right: 8, left: 100, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="oklch(0.90 0.004 240)" horizontal={false} />
                <XAxis type="number" tick={CHART_STYLE} tickLine={false} axisLine={false} tickFormatter={v => `${v.toFixed(0)}%`} />
                <YAxis type="category" dataKey="region" tick={{ ...CHART_STYLE, fontSize: 10 }} tickLine={false} axisLine={false} width={100} />
                <Tooltip contentStyle={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", borderRadius: 2 }} formatter={(v: any) => [`${Number(v).toFixed(1)}%`, "Appreciation"]} />
                <Bar dataKey="change" fill={C3} radius={[0, 2, 2, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="source-tag mt-1">Cumulative % change in median sale price from earliest to latest available month</div>
          </div>
        </div>

        {/* Latest snapshot table */}
        <div className="panel overflow-hidden">
          <SectionHeader title="Latest Snapshot — Top 15 Counties by Sale Price" source="Redfin · Mar 2026" />
          <div className="overflow-auto" style={{ maxHeight: 280 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>County</th>
                  <th>Sale Price</th>
                  <th>DOM</th>
                  <th>S/L Ratio</th>
                  <th>YoY</th>
                </tr>
              </thead>
              <tbody>
                {latestByCounty.slice(0, 15).map(c => (
                  <tr key={c.region}>
                    <td style={{ fontWeight: 500 }}>{c.region}</td>
                    <td className="mono">{fmtK(c.median_sale_price)}</td>
                    <td className="mono">{c.median_dom != null ? `${c.median_dom.toFixed(0)}d` : "—"}</td>
                    <td className="mono">{c.avg_sale_to_list != null ? `${(c.avg_sale_to_list * 100).toFixed(1)}%` : "—"}</td>
                    <td>
                      {c.median_sale_price_yoy != null ? (
                        <span className={`mono text-xs font-semibold ${c.median_sale_price_yoy >= 0 ? "trend-up" : "trend-down"}`}>
                          {c.median_sale_price_yoy >= 0 ? "+" : ""}{c.median_sale_price_yoy.toFixed(1)}%
                        </span>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div>
  );
}
