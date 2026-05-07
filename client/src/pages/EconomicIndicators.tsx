/* Ohio Blueprint — Economic Indicators
   FRED data: HPI, mortgage rates, unemployment, employment, CPI, consumer sentiment
*/

import { useMemo, useState } from "react";
import {
  LineChart, Line, AreaChart, Area, ComposedChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import economic from "@/data/economic_indicators.json";

const econData = economic as any[];

const BLUE = "oklch(0.45 0.18 255)";
const GREEN = "oklch(0.52 0.17 145)";
const AMBER = "oklch(0.72 0.18 75)";
const RED = "oklch(0.58 0.22 25)";
const CYAN = "oklch(0.58 0.16 220)";

function getSeries(name: string, from = "2015-01-01") {
  return econData
    .filter(d => d.friendly_name === name && d.date >= from)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(d => ({ date: d.date?.substring(0, 7), value: d.value }));
}

function dedup(arr: any[]) {
  const seen = new Set<string>();
  return arr.filter(d => {
    if (seen.has(d.date)) return false;
    seen.add(d.date);
    return true;
  });
}

export default function EconomicIndicators() {
  const [corrMetric, setCorrMetric] = useState("ohio_unemployment_rate");

  const hpiSeries = useMemo(() => dedup(getSeries("ohio_hpi_all_transactions")), []);
  const mortgageSeries = useMemo(() => dedup(getSeries("mortgage_rate_30yr_fixed")), []);
  const fedFundsSeries = useMemo(() => dedup(getSeries("federal_funds_rate")), []);
  const unemploySeries = useMemo(() => dedup(getSeries("ohio_unemployment_rate")), []);
  const employmentSeries = useMemo(() => dedup(getSeries("ohio_nonfarm_employment")), []);
  const cpiSeries = useMemo(() => dedup(getSeries("cpi_all_urban")), []);
  const sentimentSeries = useMemo(() => dedup(getSeries("consumer_sentiment_umich")), []);
  const listingPriceSeries = useMemo(() => dedup(getSeries("ohio_median_listing_price")), []);
  const inventorySeries = useMemo(() => dedup(getSeries("ohio_active_listing_count")), []);

  // Metro HPI comparison
  const metroHPIData = useMemo(() => {
    const metros = [
      { key: "cleveland_hpi_fhfa", label: "Cleveland", color: BLUE },
      { key: "columbus_hpi_fhfa", label: "Columbus", color: GREEN },
      { key: "cincinnati_hpi_fhfa", label: "Cincinnati", color: AMBER },
      { key: "akron_hpi_fhfa", label: "Akron", color: CYAN },
      { key: "toledo_hpi_fhfa", label: "Toledo", color: RED },
    ];
    const byDate: Record<string, any> = {};
    metros.forEach(({ key, label }) => {
      econData.filter(d => d.friendly_name === key).forEach(d => {
        const date = d.date?.substring(0, 7);
        if (!date) return;
        if (!byDate[date]) byDate[date] = { date };
        byDate[date][label] = d.value;
      });
    });
    return Object.values(byDate).sort((a: any, b: any) => a.date.localeCompare(b.date));
  }, []);

  // Mortgage + Fed Funds combined
  const rateData = useMemo(() => {
    const mortMap: Record<string, number> = {};
    const fedMap: Record<string, number> = {};
    mortgageSeries.forEach(d => { mortMap[d.date] = d.value; });
    fedFundsSeries.forEach(d => { fedMap[d.date] = d.value; });
    const dates = Array.from(new Set([...Object.keys(mortMap), ...Object.keys(fedMap)])).sort();
    return dates.map(date => ({
      date,
      mortgage_30yr: mortMap[date] ?? null,
      fed_funds: fedMap[date] ?? null,
    }));
  }, [mortgageSeries, fedFundsSeries]);

  // Correlation: HPI vs selected metric
  const corrData = useMemo(() => {
    const hpiMap: Record<string, number> = {};
    hpiSeries.forEach(d => { hpiMap[d.date] = d.value; });
    const metricSeries = dedup(getSeries(corrMetric));
    return metricSeries
      .map(d => ({ x: d.value, y: hpiMap[d.date] ?? null, date: d.date }))
      .filter(d => d.y != null);
  }, [corrMetric, hpiSeries]);

  const CORR_OPTIONS = [
    { key: "ohio_unemployment_rate", label: "Unemployment Rate" },
    { key: "mortgage_rate_30yr_fixed", label: "30-Yr Mortgage Rate" },
    { key: "federal_funds_rate", label: "Federal Funds Rate" },
    { key: "consumer_sentiment_umich", label: "Consumer Sentiment" },
    { key: "cpi_all_urban", label: "CPI (Inflation)" },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="chart-container">
        <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: BLUE }}>FRED / St. Louis Fed</div>
        <h2 className="text-xl font-bold text-foreground">Economic Indicators</h2>
        <p className="text-sm text-muted-foreground mt-1">
          21 economic time series from the Federal Reserve Bank of St. Louis — Ohio housing, mortgage rates, employment, and macroeconomic indicators.
        </p>
        <div className="flex flex-wrap gap-2 mt-3">
          {[
            { label: "Series", val: "21" },
            { label: "Observations", val: "2,934" },
            { label: "Date Range", val: "2015–2026" },
            { label: "Frequency", val: "Monthly/Quarterly" },
          ].map(b => (
            <div key={b.label} className="text-xs px-2.5 py-1 rounded-full" style={{ backgroundColor: "oklch(0.94 0.015 255)", color: "oklch(0.35 0.15 255)" }}>
              <strong>{b.val}</strong> {b.label}
            </div>
          ))}
        </div>
      </div>

      {/* Ohio HPI + Listing Price */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="chart-container">
          <h3 className="text-sm font-semibold text-foreground mb-1">Ohio House Price Index (FHFA)</h3>
          <p className="text-xs text-muted-foreground mb-4">All-Transactions HPI, Index 1980 Q1=100</p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={hpiSeries} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="hpiG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={BLUE} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={BLUE} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.90 0.008 240)" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval={5} />
              <YAxis tick={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace" }} tickLine={false} axisLine={false} width={45} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: any) => [Number(v).toFixed(1), "HPI"]} />
              <Area type="monotone" dataKey="value" stroke={BLUE} fill="url(#hpiG)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-container">
          <h3 className="text-sm font-semibold text-foreground mb-1">Ohio Median Listing Price</h3>
          <p className="text-xs text-muted-foreground mb-4">Realtor.com data via FRED, monthly</p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={listingPriceSeries} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="listG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={GREEN} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={GREEN} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.90 0.008 240)" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval={6} />
              <YAxis tick={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace" }} tickLine={false} axisLine={false} width={55} tickFormatter={v => `$${(v/1000).toFixed(0)}K`} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: any) => [`$${Number(v).toLocaleString()}`, "Listing Price"]} />
              <Area type="monotone" dataKey="value" stroke={GREEN} fill="url(#listG)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Interest rates */}
      <div className="chart-container">
        <h3 className="text-sm font-semibold text-foreground mb-1">Interest Rates: 30-Yr Mortgage vs. Federal Funds Rate</h3>
        <p className="text-xs text-muted-foreground mb-4">The Fed's rate hike cycle (2022–2023) drove mortgage rates to 20-year highs</p>
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={rateData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.90 0.008 240)" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval={8} />
            <YAxis tick={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace" }} tickLine={false} axisLine={false} width={40} tickFormatter={v => `${v}%`} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: any, name: string) => [`${Number(v).toFixed(2)}%`, name]} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="mortgage_30yr" stroke={RED} strokeWidth={2} dot={false} name="30-Yr Mortgage" connectNulls />
            <Line type="monotone" dataKey="fed_funds" stroke={AMBER} strokeWidth={2} dot={false} name="Fed Funds Rate" connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Metro HPI comparison */}
      <div className="chart-container">
        <h3 className="text-sm font-semibold text-foreground mb-1">Metro Area HPI Comparison (FHFA)</h3>
        <p className="text-xs text-muted-foreground mb-4">Cleveland, Columbus, Cincinnati, Akron, Toledo — quarterly HPI</p>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={metroHPIData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.90 0.008 240)" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval={4} />
            <YAxis tick={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace" }} tickLine={false} axisLine={false} width={45} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: any, name: string) => [Number(v).toFixed(1), name]} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {[
              { key: "Cleveland", color: BLUE },
              { key: "Columbus", color: GREEN },
              { key: "Cincinnati", color: AMBER },
              { key: "Akron", color: CYAN },
              { key: "Toledo", color: RED },
            ].map(m => (
              <Line key={m.key} type="monotone" dataKey={m.key} stroke={m.color} strokeWidth={2} dot={false} connectNulls />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Ohio employment + unemployment */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="chart-container">
          <h3 className="text-sm font-semibold text-foreground mb-1">Ohio Unemployment Rate</h3>
          <p className="text-xs text-muted-foreground mb-4">BLS monthly, seasonally adjusted</p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={unemploySeries} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="unempG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={RED} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={RED} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.90 0.008 240)" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval={6} />
              <YAxis tick={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace" }} tickLine={false} axisLine={false} width={35} tickFormatter={v => `${v}%`} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: any) => [`${Number(v).toFixed(1)}%`, "Unemployment"]} />
              <Area type="monotone" dataKey="value" stroke={RED} fill="url(#unempG)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-container">
          <h3 className="text-sm font-semibold text-foreground mb-1">Ohio Nonfarm Employment</h3>
          <p className="text-xs text-muted-foreground mb-4">BLS monthly, thousands of persons</p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={employmentSeries} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="empG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CYAN} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={CYAN} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.90 0.008 240)" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval={6} />
              <YAxis tick={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace" }} tickLine={false} axisLine={false} width={50} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: any) => [`${Number(v).toLocaleString()}K`, "Employment"]} />
              <Area type="monotone" dataKey="value" stroke={CYAN} fill="url(#empG)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Consumer sentiment */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="chart-container">
          <h3 className="text-sm font-semibold text-foreground mb-1">University of Michigan Consumer Sentiment</h3>
          <p className="text-xs text-muted-foreground mb-4">Leading indicator for housing demand</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={sentimentSeries} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.90 0.008 240)" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval={6} />
              <YAxis tick={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace" }} tickLine={false} axisLine={false} width={35} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: any) => [Number(v).toFixed(1), "Sentiment Index"]} />
              <Line type="monotone" dataKey="value" stroke={AMBER} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-container">
          <h3 className="text-sm font-semibold text-foreground mb-1">CPI — All Urban Consumers</h3>
          <p className="text-xs text-muted-foreground mb-4">Inflation context for real home price analysis</p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={cpiSeries} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="cpiG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={AMBER} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={AMBER} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.90 0.008 240)" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval={6} />
              <YAxis tick={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace" }} tickLine={false} axisLine={false} width={40} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: any) => [Number(v).toFixed(1), "CPI"]} />
              <Area type="monotone" dataKey="value" stroke={AMBER} fill="url(#cpiG)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
