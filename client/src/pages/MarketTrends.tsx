/* Ohio Blueprint — Market Trends
   Redfin county market data: median sale price, inventory, DOM, sale-to-list ratio
*/

import { useState, useMemo } from "react";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import redfin from "@/data/redfin_county_market.json";
import countySummary from "@/data/county_summary.json";

const redfinData = redfin as any[];
const counties = countySummary as any[];

const OHIO_COUNTIES = Array.from(new Set(redfinData.map(d => d.region))).sort() as string[];
const BLUE = "oklch(0.45 0.18 255)";
const GREEN = "oklch(0.52 0.17 145)";
const AMBER = "oklch(0.72 0.18 75)";
const RED = "oklch(0.58 0.22 25)";
const CYAN = "oklch(0.58 0.16 220)";

function fmtK(n: number | null | undefined) {
  if (n == null) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

export default function MarketTrends() {
  const [county1, setCounty1] = useState("Franklin County");
  const [county2, setCounty2] = useState("Cuyahoga County");
  const [metric, setMetric] = useState("median_sale_price");

  const METRICS = [
    { key: "median_sale_price", label: "Median Sale Price", fmt: fmtK },
    { key: "median_list_price", label: "Median List Price", fmt: fmtK },
    { key: "median_ppsf", label: "Price Per Sq Ft", fmt: (v: any) => v ? `$${Number(v).toFixed(0)}` : "—" },
    { key: "homes_sold", label: "Homes Sold", fmt: (v: any) => v ? Number(v).toFixed(0) : "—" },
    { key: "inventory", label: "Active Inventory", fmt: (v: any) => v ? Number(v).toFixed(0) : "—" },
    { key: "months_of_supply", label: "Months of Supply", fmt: (v: any) => v ? Number(v).toFixed(1) : "—" },
    { key: "median_dom", label: "Days on Market", fmt: (v: any) => v ? Number(v).toFixed(0) : "—" },
    { key: "avg_sale_to_list", label: "Sale-to-List Ratio", fmt: (v: any) => v ? `${(Number(v) * 100).toFixed(1)}%` : "—" },
    { key: "sold_above_list", label: "Sold Above List", fmt: (v: any) => v ? `${(Number(v) * 100).toFixed(1)}%` : "—" },
  ];

  const selectedMetric = METRICS.find(m => m.key === metric) ?? METRICS[0];

  // Build comparison chart data
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

  // Statewide aggregated trends (using all counties)
  const statewideTrend = useMemo(() => {
    const byDate: Record<string, { prices: number[]; dom: number[]; inventory: number[]; sold: number[] }> = {};
    redfinData.forEach(d => {
      const date = d.period_begin?.substring(0, 7);
      if (!date) return;
      if (!byDate[date]) byDate[date] = { prices: [], dom: [], inventory: [], sold: [] };
      if (d.median_sale_price) byDate[date].prices.push(d.median_sale_price);
      if (d.median_dom) byDate[date].dom.push(d.median_dom);
      if (d.inventory) byDate[date].inventory.push(d.inventory);
      if (d.homes_sold) byDate[date].sold.push(d.homes_sold);
    });
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({
        date,
        avg_price: v.prices.length ? v.prices.reduce((a, b) => a + b, 0) / v.prices.length : null,
        avg_dom: v.dom.length ? v.dom.reduce((a, b) => a + b, 0) / v.dom.length : null,
        total_inventory: v.inventory.length ? v.inventory.reduce((a, b) => a + b, 0) : null,
        total_sold: v.sold.length ? v.sold.reduce((a, b) => a + b, 0) : null,
      }));
  }, []);

  // Top counties by recent price appreciation
  const topAppreciation = useMemo(() => {
    const latest = new Map<string, any>();
    const oldest = new Map<string, any>();
    redfinData.forEach(d => {
      if (!d.region || !d.median_sale_price) return;
      const existing = latest.get(d.region);
      if (!existing || d.period_begin > existing.period_begin) latest.set(d.region, d);
      const old = oldest.get(d.region);
      if (!old || d.period_begin < old.period_begin) oldest.set(d.region, d);
    });
    const result: any[] = [];
    latest.forEach((l, region) => {
      const o = oldest.get(region);
      if (o && o.median_sale_price && l.median_sale_price) {
        const change = (l.median_sale_price - o.median_sale_price) / o.median_sale_price * 100;
        result.push({ region, latest_price: l.median_sale_price, change, latest_date: l.period_begin });
      }
    });
    return result.sort((a, b) => b.change - a.change).slice(0, 10);
  }, []);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="chart-container" style={{ backgroundImage: `url(https://d2xsxph8kpxj0f.cloudfront.net/310519663613189187/PkeVEBVLWZFZJFDuPiXFCT/ohio-data-viz-bg-DW7BbVyqnaktKZAYSkhELd.webp)`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="relative z-10 p-2">
          <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "oklch(0.65 0.18 255)" }}>Redfin Market Tracker</div>
          <h2 className="text-xl font-bold text-white">Ohio Housing Market Trends</h2>
          <p className="text-sm mt-1" style={{ color: "oklch(0.78 0.02 240)" }}>
            Monthly market data for all 88 Ohio counties — January 2020 to March 2026
          </p>
        </div>
      </div>

      {/* Statewide trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="chart-container">
          <h3 className="text-sm font-semibold text-foreground mb-1">Statewide Avg. Sale Price</h3>
          <p className="text-xs text-muted-foreground mb-4">Average across all Ohio counties reporting</p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={statewideTrend} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={BLUE} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={BLUE} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.90 0.008 240)" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval={6} />
              <YAxis tick={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace" }} tickLine={false} axisLine={false} width={55} tickFormatter={v => `$${(v/1000).toFixed(0)}K`} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: any) => [`$${Number(v).toLocaleString()}`, "Avg Sale Price"]} />
              <Area type="monotone" dataKey="avg_price" stroke={BLUE} fill="url(#priceGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-container">
          <h3 className="text-sm font-semibold text-foreground mb-1">Statewide Avg. Days on Market</h3>
          <p className="text-xs text-muted-foreground mb-4">Lower = faster-moving market (seller's market)</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={statewideTrend} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.90 0.008 240)" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval={6} />
              <YAxis tick={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace" }} tickLine={false} axisLine={false} width={35} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: any) => [`${Number(v).toFixed(1)} days`, "Avg DOM"]} />
              <Line type="monotone" dataKey="avg_dom" stroke={AMBER} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* County comparison */}
      <div className="chart-container">
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <h3 className="text-sm font-semibold text-foreground">County Comparison</h3>
          <div className="flex gap-2 flex-wrap flex-1">
            <Select value={county1} onValueChange={setCounty1}>
              <SelectTrigger className="w-[180px] bg-white text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OHIO_COUNTIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={county2} onValueChange={setCounty2}>
              <SelectTrigger className="w-[180px] bg-white text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OHIO_COUNTIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={metric} onValueChange={setMetric}>
              <SelectTrigger className="w-[200px] bg-white text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {METRICS.map(m => <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={comparisonData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.90 0.008 240)" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval={6} />
            <YAxis
              tick={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace" }}
              tickLine={false}
              axisLine={false}
              width={60}
              tickFormatter={(v) => metric.includes("price") || metric.includes("ppsf") ? `$${(v/1000).toFixed(0)}K` : String(v)}
            />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
              formatter={(v: any, name: string) => [selectedMetric.fmt(v), name]}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey={county1} stroke={BLUE} strokeWidth={2} dot={false} connectNulls />
            <Line type="monotone" dataKey={county2} stroke={RED} strokeWidth={2} dot={false} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Top appreciation counties */}
      <div className="chart-container">
        <h3 className="text-sm font-semibold text-foreground mb-1">Top 10 Counties by Price Appreciation</h3>
        <p className="text-xs text-muted-foreground mb-4">Cumulative % change in median sale price (2020–2026)</p>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart
            data={topAppreciation}
            layout="vertical"
            margin={{ top: 0, right: 10, left: 110, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.90 0.008 240)" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `${v.toFixed(0)}%`} />
            <YAxis type="category" dataKey="region" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={110} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: any) => [`${Number(v).toFixed(1)}%`, "Appreciation"]} />
            <Bar dataKey="change" fill={GREEN} radius={[0, 4, 4, 0]} name="Price Change %" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
