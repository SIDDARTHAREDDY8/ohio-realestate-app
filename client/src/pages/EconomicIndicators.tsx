/*
 * Economic Indicators — Data Terminal style
 * FRED time series: HPI, mortgage rates, employment, CPI, sentiment
 * Dense charts, source citations, no decorative chrome
 */

import { useMemo } from "react";
import {
  LineChart, Line, AreaChart, Area, ComposedChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  ReferenceLine,
} from "recharts";
import { ExternalLink } from "lucide-react";
import economic from "@/data/economic_indicators.json";

const econData = economic as any[];

// Header stats computed from the shipped data rather than hardcoded
const SERIES_COUNT = new Set(econData.map(d => d.friendly_name)).size;
const ECON_YEARS = econData.map(d => d.date?.substring(0, 4)).filter(Boolean).sort();
const ECON_RANGE = ECON_YEARS.length ? `${ECON_YEARS[0]}–${ECON_YEARS[ECON_YEARS.length - 1]}` : "—";

const C1 = "oklch(0.38 0.12 250)";
const C2 = "oklch(0.52 0.14 220)";
const C3 = "oklch(0.48 0.16 145)";
const C4 = "oklch(0.55 0.20 25)";
const C5 = "oklch(0.62 0.18 75)";
const C6 = "oklch(0.58 0.14 185)";

const CHART_STYLE = { fontSize: 10, fontFamily: "'Inter', sans-serif" };

function getSeries(name: string, from = "2015-01-01") {
  return econData
    .filter(d => d.friendly_name === name && d.date >= from)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(d => ({ date: d.date?.substring(0, 7), value: d.value }))
    .filter((d, i, a) => i === a.findIndex(x => x.date === d.date));
}

function SectionHeader({ title, source, url, note }: { title: string; source: string; url?: string; note?: string }) {
  return (
    <div className="section-header">
      <span className="section-title">{title}</span>
      <div className="flex items-center gap-3">
        {note && <span className="source-tag">{note}</span>}
        <span className="source-tag flex items-center gap-0.5">
          {url ? (
            <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-0.5 hover:underline">
              {source} <ExternalLink className="w-2.5 h-2.5" />
            </a>
          ) : source}
        </span>
      </div>
    </div>
  );
}

export default function EconomicIndicators() {
  const hpiSeries = useMemo(() => getSeries("ohio_hpi_all_transactions"), []);
  const mortgageSeries = useMemo(() => getSeries("mortgage_rate_30yr_fixed"), []);
  const fedFundsSeries = useMemo(() => getSeries("federal_funds_rate"), []);
  const unemploySeries = useMemo(() => getSeries("ohio_unemployment_rate"), []);
  const employmentSeries = useMemo(() => getSeries("ohio_nonfarm_employment"), []);
  const cpiSeries = useMemo(() => getSeries("cpi_all_urban"), []);
  const sentimentSeries = useMemo(() => getSeries("consumer_sentiment_umich"), []);
  const listingPriceSeries = useMemo(() => getSeries("ohio_median_listing_price"), []);
  const inventorySeries = useMemo(() => getSeries("ohio_active_listing_count"), []);

  // Metro HPI comparison
  const metroHPIData = useMemo(() => {
    const metros = [
      { key: "cleveland_hpi_fhfa", label: "Cleveland", color: C1 },
      { key: "columbus_hpi_fhfa", label: "Columbus", color: C3 },
      { key: "cincinnati_hpi_fhfa", label: "Cincinnati", color: C5 },
      { key: "akron_hpi_fhfa", label: "Akron", color: C2 },
      { key: "toledo_hpi_fhfa", label: "Toledo", color: C4 },
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

  // Rate comparison
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

  // Real HPI (inflation-adjusted)
  const realHPIData = useMemo(() => {
    const cpiMap: Record<string, number> = {};
    cpiSeries.forEach(d => { cpiMap[d.date] = d.value; });
    const baseCPI = cpiSeries[0]?.value ?? 100;
    return hpiSeries.map(d => ({
      date: d.date,
      nominal: d.value,
      real: cpiMap[d.date] ? (d.value / cpiMap[d.date]) * baseCPI : null,
    }));
  }, [hpiSeries, cpiSeries]);

  // Series metadata table
  const SERIES_META = [
    { id: "OHSTHPI", name: "Ohio HPI", type: "Quarterly", source: "FHFA", n: hpiSeries.length, latest: hpiSeries[hpiSeries.length-1]?.value?.toFixed(1) },
    { id: "MEDLISPRIOH", name: "OH Listing Price", type: "Monthly", source: "Realtor.com", n: listingPriceSeries.length, latest: `$${(listingPriceSeries[listingPriceSeries.length-1]?.value/1000)?.toFixed(0)}K` },
    { id: "ACTLISCOUOH", name: "OH Active Listings", type: "Monthly", source: "Realtor.com", n: inventorySeries.length, latest: inventorySeries[inventorySeries.length-1]?.value?.toLocaleString() },
    { id: "MORTGAGE30US", name: "30-Yr Mortgage Rate", type: "Weekly", source: "Freddie Mac", n: mortgageSeries.length, latest: `${mortgageSeries[mortgageSeries.length-1]?.value?.toFixed(2)}%` },
    { id: "FEDFUNDS", name: "Federal Funds Rate", type: "Monthly", source: "Federal Reserve", n: fedFundsSeries.length, latest: `${fedFundsSeries[fedFundsSeries.length-1]?.value?.toFixed(2)}%` },
    { id: "OHUR", name: "OH Unemployment", type: "Monthly", source: "BLS", n: unemploySeries.length, latest: `${unemploySeries[unemploySeries.length-1]?.value?.toFixed(1)}%` },
    { id: "OHNA", name: "OH Nonfarm Employment", type: "Monthly", source: "BLS", n: employmentSeries.length, latest: `${employmentSeries[employmentSeries.length-1]?.value?.toLocaleString()}K` },
    { id: "CPIAUCSL", name: "CPI All Urban", type: "Monthly", source: "BLS", n: cpiSeries.length, latest: cpiSeries[cpiSeries.length-1]?.value?.toFixed(1) },
    { id: "UMCSENT", name: "Consumer Sentiment", type: "Monthly", source: "U of Michigan", n: sentimentSeries.length, latest: sentimentSeries[sentimentSeries.length-1]?.value?.toFixed(1) },
  ];

  return (
    <div className="p-4 space-y-4">

      {/* Series inventory table */}
      <div className="panel">
        <SectionHeader
          title="FRED Economic Series Inventory"
          source="FRED · St. Louis Fed"
          url="https://fred.stlouisfed.org/"
          note={`${SERIES_COUNT} series · ${econData.length.toLocaleString("en-US")} observations · ${ECON_RANGE}`}
        />
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Series ID</th>
                <th>Description</th>
                <th>Frequency</th>
                <th>Source</th>
                <th>Observations</th>
                <th>Latest Value</th>
              </tr>
            </thead>
            <tbody>
              {SERIES_META.map(s => (
                <tr key={s.id}>
                  <td>
                    <a href={`https://fred.stlouisfed.org/series/${s.id}`} target="_blank" rel="noopener noreferrer"
                      className="source-tag hover:underline flex items-center gap-0.5">
                      {s.id} <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </td>
                  <td style={{ fontWeight: 500, fontSize: 12 }}>{s.name}</td>
                  <td className="source-tag">{s.type}</td>
                  <td className="source-tag">{s.source}</td>
                  <td className="mono">{s.n}</td>
                  <td className="mono font-semibold">{s.latest ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* HPI nominal vs real */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="panel">
          <SectionHeader title="Ohio HPI — Nominal vs. Real (CPI-Adjusted)" source="FHFA via FRED · OHSTHPI" url="https://fred.stlouisfed.org/series/OHSTHPI" note="Index 1980 Q1=100" />
          <div className="p-3">
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={realHPIData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="oklch(0.90 0.004 240)" />
                <XAxis dataKey="date" tick={CHART_STYLE} tickLine={false} axisLine={false} minTickGap={60} />
                <YAxis tick={CHART_STYLE} tickLine={false} axisLine={false} width={42} />
                <Tooltip contentStyle={{ fontSize: 11, fontFamily: "'Inter', sans-serif", borderRadius: 2 }} formatter={(v: any, n: string) => [Number(v).toFixed(1), n]} />
                <Legend wrapperStyle={{ fontSize: 10, fontFamily: "'Inter', sans-serif" }} />
                <Line type="monotone" dataKey="nominal" stroke={C1} strokeWidth={1.5} dot={false} name="Nominal HPI" />
                <Line type="monotone" dataKey="real" stroke={C3} strokeWidth={1.5} dot={false} strokeDasharray="4 2" name="Real HPI (CPI-adj)" connectNulls />
              </LineChart>
            </ResponsiveContainer>
            <div className="source-tag mt-1">Real HPI = Nominal HPI / CPI × base CPI. Divergence shows inflation-driven vs. fundamental price growth.</div>
          </div>
        </div>

        <div className="panel">
          <SectionHeader title="Metro Area HPI Comparison (FHFA)" source="FHFA via FRED" url="https://fred.stlouisfed.org/" note="Quarterly · 5 Ohio metros" />
          <div className="p-3">
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={metroHPIData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="oklch(0.90 0.004 240)" />
                <XAxis dataKey="date" tick={CHART_STYLE} tickLine={false} axisLine={false} minTickGap={60} />
                <YAxis tick={CHART_STYLE} tickLine={false} axisLine={false} width={42} />
                <Tooltip contentStyle={{ fontSize: 11, fontFamily: "'Inter', sans-serif", borderRadius: 2 }} formatter={(v: any, n: string) => [Number(v).toFixed(1), n]} />
                <Legend wrapperStyle={{ fontSize: 10, fontFamily: "'Inter', sans-serif" }} />
                {[
                  { key: "Columbus", color: C3 },
                  { key: "Cincinnati", color: C5 },
                  { key: "Cleveland", color: C1 },
                  { key: "Akron", color: C2 },
                  { key: "Toledo", color: C4 },
                ].map(m => (
                  <Line key={m.key} type="monotone" dataKey={m.key} stroke={m.color} strokeWidth={1.5} dot={false} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Interest rates */}
      <div className="panel">
        <SectionHeader title="Interest Rates: 30-Yr Mortgage vs. Federal Funds Rate" source="Freddie Mac + Federal Reserve via FRED" url="https://fred.stlouisfed.org/" note="The 2022–2023 rate hike cycle drove mortgage rates to 20-year highs" />
        <div className="p-3">
          <ResponsiveContainer width="100%" height={180}>
            <ComposedChart data={rateData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="oklch(0.90 0.004 240)" />
              <XAxis dataKey="date" tick={CHART_STYLE} tickLine={false} axisLine={false} minTickGap={60} />
              <YAxis tick={CHART_STYLE} tickLine={false} axisLine={false} width={35} tickFormatter={v => `${v}%`} />
              <Tooltip contentStyle={{ fontSize: 11, fontFamily: "'Inter', sans-serif", borderRadius: 2 }} formatter={(v: any, n: string) => [`${Number(v).toFixed(2)}%`, n]} />
              <Legend wrapperStyle={{ fontSize: 10, fontFamily: "'Inter', sans-serif" }} />
              <ReferenceLine y={7} stroke={C4} strokeDasharray="3 3" strokeWidth={1} />
              <Line type="monotone" dataKey="mortgage_30yr" stroke={C4} strokeWidth={1.5} dot={false} name="30-Yr Mortgage" connectNulls />
              <Line type="monotone" dataKey="fed_funds" stroke={C5} strokeWidth={1.5} dot={false} name="Fed Funds Rate" connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
          <div className="source-tag mt-1">Reference line: 7% threshold. Mortgage rate spread over fed funds rate reflects credit risk premium.</div>
        </div>
      </div>

      {/* Ohio listing price + inventory */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="panel">
          <SectionHeader title="Ohio Median Listing Price" source="Realtor.com via FRED · MEDLISPRIOH" url="https://fred.stlouisfed.org/series/MEDLISPRIOH" />
          <div className="p-3">
            <ResponsiveContainer width="100%" height={150}>
              <AreaChart data={listingPriceSeries} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="listG2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C3} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={C3} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" stroke="oklch(0.90 0.004 240)" />
                <XAxis dataKey="date" tick={CHART_STYLE} tickLine={false} axisLine={false} minTickGap={60} />
                <YAxis tick={CHART_STYLE} tickLine={false} axisLine={false} width={52} tickFormatter={v => `$${(v/1000).toFixed(0)}K`} />
                <Tooltip contentStyle={{ fontSize: 11, fontFamily: "'Inter', sans-serif", borderRadius: 2 }} formatter={(v: any) => [`$${Number(v).toLocaleString()}`, "Listing Price"]} />
                <Area type="monotone" dataKey="value" stroke={C3} fill="url(#listG2)" strokeWidth={1.5} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel">
          <SectionHeader title="Ohio Active Listing Count" source="Realtor.com via FRED · ACTLISCOUOH" url="https://fred.stlouisfed.org/series/ACTLISCOUOH" />
          <div className="p-3">
            <ResponsiveContainer width="100%" height={150}>
              <AreaChart data={inventorySeries} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="invG2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C2} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={C2} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" stroke="oklch(0.90 0.004 240)" />
                <XAxis dataKey="date" tick={CHART_STYLE} tickLine={false} axisLine={false} minTickGap={60} />
                <YAxis tick={CHART_STYLE} tickLine={false} axisLine={false} width={42} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
                <Tooltip contentStyle={{ fontSize: 11, fontFamily: "'Inter', sans-serif", borderRadius: 2 }} formatter={(v: any) => [Number(v).toLocaleString(), "Active Listings"]} />
                <Area type="monotone" dataKey="value" stroke={C2} fill="url(#invG2)" strokeWidth={1.5} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Employment + unemployment */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="panel">
          <SectionHeader title="Ohio Unemployment Rate" source="BLS via FRED · OHUR" url="https://fred.stlouisfed.org/series/OHUR" note="Monthly · seasonally adjusted" />
          <div className="p-3">
            <ResponsiveContainer width="100%" height={150}>
              <AreaChart data={unemploySeries} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="unempG2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C4} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={C4} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" stroke="oklch(0.90 0.004 240)" />
                <XAxis dataKey="date" tick={CHART_STYLE} tickLine={false} axisLine={false} minTickGap={60} />
                <YAxis tick={CHART_STYLE} tickLine={false} axisLine={false} width={35} tickFormatter={v => `${v}%`} />
                <Tooltip contentStyle={{ fontSize: 11, fontFamily: "'Inter', sans-serif", borderRadius: 2 }} formatter={(v: any) => [`${Number(v).toFixed(1)}%`, "Unemployment"]} />
                <ReferenceLine y={4} stroke={C3} strokeDasharray="3 3" strokeWidth={1} />
                <Area type="monotone" dataKey="value" stroke={C4} fill="url(#unempG2)" strokeWidth={1.5} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
            <div className="source-tag mt-1">COVID-19 spike (Apr 2020: ~17%) visible. Reference: 4% full-employment threshold.</div>
          </div>
        </div>

        <div className="panel">
          <SectionHeader title="Ohio Nonfarm Employment" source="BLS via FRED · OHNA" url="https://fred.stlouisfed.org/series/OHNA" note="Monthly · thousands of persons" />
          <div className="p-3">
            <ResponsiveContainer width="100%" height={150}>
              <AreaChart data={employmentSeries} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="empG2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C6} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={C6} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" stroke="oklch(0.90 0.004 240)" />
                <XAxis dataKey="date" tick={CHART_STYLE} tickLine={false} axisLine={false} minTickGap={60} />
                <YAxis tick={CHART_STYLE} tickLine={false} axisLine={false} width={50} />
                <Tooltip contentStyle={{ fontSize: 11, fontFamily: "'Inter', sans-serif", borderRadius: 2 }} formatter={(v: any) => [`${Number(v).toLocaleString()}K`, "Employment"]} />
                <Area type="monotone" dataKey="value" stroke={C6} fill="url(#empG2)" strokeWidth={1.5} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Consumer sentiment + CPI */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="panel">
          <SectionHeader title="Consumer Sentiment Index" source="U of Michigan via FRED · UMCSENT" url="https://fred.stlouisfed.org/series/UMCSENT" note="Leading indicator for housing demand" />
          <div className="p-3">
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={sentimentSeries} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="oklch(0.90 0.004 240)" />
                <XAxis dataKey="date" tick={CHART_STYLE} tickLine={false} axisLine={false} minTickGap={60} />
                <YAxis tick={CHART_STYLE} tickLine={false} axisLine={false} width={35} />
                <Tooltip contentStyle={{ fontSize: 11, fontFamily: "'Inter', sans-serif", borderRadius: 2 }} formatter={(v: any) => [Number(v).toFixed(1), "Sentiment"]} />
                <Line type="monotone" dataKey="value" stroke={C5} strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel">
          <SectionHeader title="CPI — All Urban Consumers" source="BLS via FRED · CPIAUCSL" url="https://fred.stlouisfed.org/series/CPIAUCSL" note="Used to compute real HPI above" />
          <div className="p-3">
            <ResponsiveContainer width="100%" height={150}>
              <AreaChart data={cpiSeries} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="cpiG2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C5} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={C5} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" stroke="oklch(0.90 0.004 240)" />
                <XAxis dataKey="date" tick={CHART_STYLE} tickLine={false} axisLine={false} minTickGap={60} />
                <YAxis tick={CHART_STYLE} tickLine={false} axisLine={false} width={40} />
                <Tooltip contentStyle={{ fontSize: 11, fontFamily: "'Inter', sans-serif", borderRadius: 2 }} formatter={(v: any) => [Number(v).toFixed(1), "CPI"]} />
                <Area type="monotone" dataKey="value" stroke={C5} fill="url(#cpiG2)" strokeWidth={1.5} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

    </div>
  );
}
