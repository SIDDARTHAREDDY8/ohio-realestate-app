/* Ohio Blueprint — Dashboard Overview
   KPI cards, statewide metrics, top counties, HPI trend
*/

import { useMemo } from "react";
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { TrendingUp, TrendingDown, Home, DollarSign, Users, Activity, ArrowUpRight, ArrowDownRight } from "lucide-react";
import kpisData from "@/data/kpis.json";
import countySummary from "@/data/county_summary.json";
import economicData from "@/data/economic_indicators.json";
import hpiForecast from "@/data/hpi_forecast.json";

const kpis = kpisData as any;
const counties = countySummary as any[];
const economic = economicData as any[];
const forecast = hpiForecast as any[];

function fmt(n: number | null | undefined, prefix = "", suffix = "", decimals = 0) {
  if (n == null) return "N/A";
  return `${prefix}${n.toLocaleString("en-US", { maximumFractionDigits: decimals })}${suffix}`;
}

function fmtK(n: number | null | undefined) {
  if (n == null) return "N/A";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function TrendBadge({ value, suffix = "%" }: { value: number | null; suffix?: string }) {
  if (value == null) return null;
  const isUp = value >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${isUp ? "trend-up" : "trend-down"}`}>
      {isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
      {Math.abs(value).toFixed(1)}{suffix}
    </span>
  );
}

function KPICard({
  title, value, subtitle, trend, icon: Icon, color
}: {
  title: string;
  value: string;
  subtitle?: string;
  trend?: number | null;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="metric-card">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center`} style={{ backgroundColor: color + "18" }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        {trend != null && <TrendBadge value={trend} />}
      </div>
      <div className="data-value text-2xl font-bold text-foreground mb-1">{value}</div>
      <div className="text-sm font-medium text-foreground mb-0.5">{title}</div>
      {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
    </div>
  );
}

export default function Dashboard() {
  // Process HPI data for chart
  const hpiChartData = useMemo(() => {
    const hpiSeries = economic.filter(d => d.friendly_name === "ohio_hpi_all_transactions");
    const mortgageSeries = economic.filter(d => d.friendly_name === "mortgage_rate_30yr_fixed");

    // Monthly mortgage rate
    const mortgageByDate: Record<string, number> = {};
    mortgageSeries.forEach(d => {
      const month = d.date?.substring(0, 7);
      if (month) mortgageByDate[month] = d.value;
    });

    return hpiSeries
      .filter(d => d.date >= "2018-01-01")
      .map(d => ({
        date: d.date,
        hpi: d.value,
        label: d.date?.substring(0, 7),
        mortgage: mortgageByDate[d.date?.substring(0, 7)] ?? null,
      }));
  }, []);

  // Forecast data
  const forecastChartData = useMemo(() => {
    const historical = hpiChartData.slice(-12).map(d => ({
      date: d.label,
      actual: d.hpi,
      forecast: null as number | null,
      lower: null as number | null,
      upper: null as number | null,
    }));
    const future = forecast
      .filter(d => d.date > (hpiChartData[hpiChartData.length - 1]?.date ?? ""))
      .slice(0, 8)
      .map(d => ({
        date: d.date?.substring(0, 7),
        actual: null as number | null,
        forecast: d.hpi_forecast,
        lower: d.hpi_lower,
        upper: d.hpi_upper,
      }));
    return [...historical, ...future];
  }, [hpiChartData]);

  // Top 10 counties by home value
  const top10Counties = useMemo(() =>
    [...counties]
      .filter(c => c.median_home_value_2023 != null)
      .sort((a, b) => b.median_home_value_2023 - a.median_home_value_2023)
      .slice(0, 10),
    []
  );

  // Bottom 10 by affordability
  const leastAffordable = useMemo(() =>
    [...counties]
      .filter(c => c.affordability_index != null)
      .sort((a, b) => a.affordability_index - b.affordability_index)
      .slice(0, 8),
    []
  );

  // Mortgage rate trend
  const mortgageData = useMemo(() =>
    economic
      .filter(d => d.friendly_name === "mortgage_rate_30yr_fixed" && d.date >= "2020-01-01")
      .map(d => ({ date: d.date?.substring(0, 7), rate: d.value }))
      .filter((d, i, arr) => i === arr.findIndex(x => x.date === d.date)),
    []
  );

  // Listing price trend
  const listingData = useMemo(() =>
    economic
      .filter(d => d.friendly_name === "ohio_median_listing_price" && d.date >= "2020-01-01")
      .map(d => ({ date: d.date?.substring(0, 7), price: d.value })),
    []
  );

  const BLUE = "oklch(0.45 0.18 255)";
  const CYAN = "oklch(0.58 0.16 220)";
  const GREEN = "oklch(0.52 0.17 145)";
  const AMBER = "oklch(0.72 0.18 75)";
  const RED = "oklch(0.58 0.22 25)";

  return (
    <div className="p-6 space-y-6">
      {/* Hero banner */}
      <div
        className="relative rounded-xl overflow-hidden"
        style={{ minHeight: 200 }}
      >
        <img
          src="https://d2xsxph8kpxj0f.cloudfront.net/310519663613189187/PkeVEBVLWZFZJFDuPiXFCT/ohio-hero-map-96YjpLoXHWCFdJuti3kCJB.webp"
          alt="Ohio Market Intelligence"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(135deg, oklch(0.13 0.025 255 / 0.92) 0%, oklch(0.13 0.025 255 / 0.7) 50%, transparent 100%)" }}
        />
        <div className="relative z-10 p-8">
          <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "oklch(0.65 0.18 255)" }}>
            Ohio Real Estate Market Intelligence
          </div>
          <h1 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            Statewide Market Overview
          </h1>
          <p className="text-sm max-w-lg" style={{ color: "oklch(0.78 0.02 240)" }}>
            Real-time analytics across all 88 Ohio counties — powered by US Census Bureau ACS, Redfin Market Tracker, and FRED economic data.
          </p>
          <div className="flex flex-wrap gap-3 mt-4">
            {[
              { label: "88 Counties", val: "Analyzed" },
              { label: "Data Sources", val: "3 APIs" },
              { label: "ML Models", val: "4 Active" },
              { label: "Time Range", val: "2015–2026" },
            ].map(b => (
              <div key={b.label} className="px-3 py-1.5 rounded-lg text-xs" style={{ backgroundColor: "oklch(1 0 0 / 0.12)", color: "white" }}>
                <span style={{ color: "oklch(0.65 0.18 255)" }}>{b.val}</span> {b.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Avg. Home Value"
          value={fmtK(kpis.statewide?.avg_home_value)}
          subtitle="2023 ACS 5-Year Estimate"
          trend={kpis.statewide?.avg_5yr_appreciation_pct}
          icon={Home}
          color="oklch(0.45 0.18 255)"
        />
        <KPICard
          title="Median Listing Price"
          value={fmtK(kpis.latest_listing_price)}
          subtitle="Latest FRED / Realtor.com"
          icon={DollarSign}
          color="oklch(0.52 0.17 145)"
        />
        <KPICard
          title="30-Yr Mortgage Rate"
          value={fmt(kpis.mortgage_rate_30yr, "", "%", 2)}
          subtitle="Freddie Mac Primary Market Survey"
          icon={TrendingUp}
          color="oklch(0.72 0.18 75)"
        />
        <KPICard
          title="Unemployment Rate"
          value={fmt(kpis.unemployment_rate, "", "%", 1)}
          subtitle="Ohio BLS, latest available"
          icon={Users}
          color="oklch(0.58 0.22 25)"
        />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Avg. Homeownership"
          value={fmt(kpis.statewide?.avg_homeownership_rate, "", "%", 1)}
          subtitle="Owner-occupied units"
          icon={Home}
          color="oklch(0.58 0.16 220)"
        />
        <KPICard
          title="Avg. Gross Rent"
          value={fmtK(kpis.statewide?.avg_rent)}
          subtitle="Monthly median, 2023"
          icon={DollarSign}
          color="oklch(0.65 0.14 185)"
        />
        <KPICard
          title="Ohio HPI"
          value={fmt(kpis.hpi, "", "", 1)}
          subtitle="FHFA All-Transactions Index"
          icon={Activity}
          color="oklch(0.45 0.18 255)"
        />
        <KPICard
          title="Total Population"
          value={fmt(kpis.statewide?.total_population ? kpis.statewide.total_population / 1_000_000 : null, "", "M", 2)}
          subtitle="2023 ACS estimate"
          icon={Users}
          color="oklch(0.52 0.17 145)"
        />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ohio HPI Trend + Forecast */}
        <div className="chart-container">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-foreground">Ohio House Price Index — Trend & Forecast</h3>
            <p className="text-xs text-muted-foreground mt-0.5">FHFA All-Transactions HPI with Prophet ML forecast (shaded = 95% CI)</p>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={forecastChartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="hpiGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={BLUE} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={BLUE} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={AMBER} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={AMBER} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.90 0.008 240)" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval={5} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={45} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid oklch(0.90 0.008 240)" }}
                formatter={(v: any, name: string) => [v?.toFixed ? v.toFixed(1) : v, name]}
              />
              <Area type="monotone" dataKey="actual" stroke={BLUE} fill="url(#hpiGrad)" strokeWidth={2} name="Actual HPI" dot={false} />
              <Area type="monotone" dataKey="forecast" stroke={AMBER} fill="url(#forecastGrad)" strokeWidth={2} strokeDasharray="5 3" name="Forecast" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* 30-Year Mortgage Rate */}
        <div className="chart-container">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-foreground">30-Year Fixed Mortgage Rate</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Freddie Mac Primary Mortgage Market Survey, weekly (2020–2026)</p>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={mortgageData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.90 0.008 240)" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval={10} />
              <YAxis tick={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace" }} tickLine={false} axisLine={false} width={40} domain={["auto", "auto"]} tickFormatter={(v) => `${v}%`} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                formatter={(v: any) => [`${Number(v).toFixed(2)}%`, "30-Yr Rate"]}
              />
              <Line type="monotone" dataKey="rate" stroke={RED} strokeWidth={2} dot={false} name="30-Yr Rate" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 10 Counties by Home Value */}
        <div className="chart-container">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-foreground">Top 10 Counties — Median Home Value (2023)</h3>
            <p className="text-xs text-muted-foreground mt-0.5">US Census Bureau ACS 5-Year Estimates</p>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={top10Counties}
              layout="vertical"
              margin={{ top: 0, right: 10, left: 80, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.90 0.008 240)" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`}
              />
              <YAxis
                type="category"
                dataKey="county_name"
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={80}
              />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                formatter={(v: any) => [`$${Number(v).toLocaleString()}`, "Median Home Value"]}
              />
              <Bar dataKey="median_home_value_2023" fill={BLUE} radius={[0, 4, 4, 0]} name="Median Home Value" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Ohio Median Listing Price */}
        <div className="chart-container">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-foreground">Ohio Median Listing Price</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Realtor.com via FRED, monthly (2020–2026)</p>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={listingData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="listingGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={GREEN} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={GREEN} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.90 0.008 240)" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval={6} />
              <YAxis
                tick={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace" }}
                tickLine={false}
                axisLine={false}
                width={55}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`}
              />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                formatter={(v: any) => [`$${Number(v).toLocaleString()}`, "Median Listing Price"]}
              />
              <Area type="monotone" dataKey="price" stroke={GREEN} fill="url(#listingGrad)" strokeWidth={2} name="Listing Price" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* County table */}
      <div className="chart-container overflow-hidden">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">County Summary — All 88 Ohio Counties</h3>
            <p className="text-xs text-muted-foreground mt-0.5">2023 ACS estimates with 5-year appreciation and affordability metrics</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: "oklch(0.90 0.008 240)" }}>
                {["County", "Region", "Median Home Value", "Median Rent", "Homeownership", "5-Yr Appreciation", "Affordability Index"].map(h => (
                  <th key={h} className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...counties]
                .sort((a, b) => (b.median_home_value_2023 ?? 0) - (a.median_home_value_2023 ?? 0))
                .map((c, i) => (
                  <tr
                    key={c.county_fips}
                    className="border-b transition-colors hover:bg-muted/50"
                    style={{ borderColor: "oklch(0.93 0.005 240)" }}
                  >
                    <td className="py-2 px-3 font-medium text-foreground">{c.county_name}</td>
                    <td className="py-2 px-3 text-muted-foreground">{c.region ?? "—"}</td>
                    <td className="py-2 px-3 data-value font-semibold">{fmtK(c.median_home_value_2023)}</td>
                    <td className="py-2 px-3 data-value">{fmtK(c.median_rent_2023)}/mo</td>
                    <td className="py-2 px-3 data-value">{c.homeownership_rate_2023 != null ? `${c.homeownership_rate_2023.toFixed(1)}%` : "—"}</td>
                    <td className="py-2 px-3">
                      {c.home_value_5yr_change != null ? (
                        <TrendBadge value={c.home_value_5yr_change} />
                      ) : "—"}
                    </td>
                    <td className="py-2 px-3">
                      {c.affordability_index != null ? (
                        <span className={`data-value text-xs font-semibold ${c.affordability_index >= 100 ? "trend-up" : c.affordability_index >= 80 ? "trend-neutral" : "trend-down"}`}>
                          {c.affordability_index.toFixed(0)}
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
  );
}
