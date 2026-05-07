/*
 * DashboardLayout — Data Terminal style
 * Plain text sidebar — no icons, no decorative chrome
 * Navigation looks like a real internal data tool, not a SaaS product
 */

import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLiveData, type LiveMetric } from "@/hooks/useLiveData";

const NAV_ITEMS = [
  { path: "/",                    label: "Overview",   abbr: "01" },
  { path: "/county-explorer",     label: "Counties",   abbr: "02" },
  { path: "/market-trends",       label: "Market",     abbr: "03" },
  { path: "/ml-insights",         label: "ML Models",  abbr: "04" },
  { path: "/economic-indicators", label: "Economics",  abbr: "05" },
  { path: "/about",               label: "About",      abbr: "06" },
];

function fmt(v: number | null, pre = "", suf = "", dec = 2) {
  if (v == null) return "—";
  return `${pre}${v.toLocaleString("en-US", { maximumFractionDigits: dec })}${suf}`;
}
function fmtK(v: number | null) {
  if (v == null) return "—";
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v}`;
}

interface TickerItemProps {
  label: string;
  value: string;
  metric: LiveMetric;
}

function TickerItem({ label, value, metric }: TickerItemProps) {
  return (
    <div className="ticker-item">
      <div className="ticker-label">{label}</div>
      <div className="ticker-value">{value}</div>
      <div className="flex items-center gap-1 mt-0.5">
        {metric.isLive && (
          <span style={{
            display: "inline-block",
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: "oklch(0.52 0.16 145)",
            flexShrink: 0,
          }} />
        )}
        <span className="source-tag" style={{ fontSize: 9 }}>
          {metric.source} · {metric.date ?? "—"}
        </span>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const live = useLiveData();

  const pipelineDate = live.lastPipelineRun
    ? new Date(live.lastPipelineRun).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "—";

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--background)" }}>

      {/* ── Sidebar — plain text, no icons ── */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col transition-transform duration-200",
          "w-[200px]",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
        style={{ background: "oklch(0.10 0.006 240)", borderRight: "1px solid oklch(0.18 0.008 240)" }}
      >
        {/* Brand — plain text only */}
        <div
          className="px-4 py-4"
          style={{ borderBottom: "1px solid oklch(0.18 0.008 240)" }}
        >
          <div
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 13,
              fontWeight: 700,
              color: "oklch(0.85 0.008 240)",
              letterSpacing: "0.02em",
            }}
          >
            OH-RE-INTEL
          </div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: "oklch(0.38 0.008 240)", marginTop: 2 }}>
            v2.0 · 88 counties
          </div>
          <button className="absolute top-4 right-3 lg:hidden" onClick={() => setMobileOpen(false)}>
            <X className="w-3.5 h-3.5" style={{ color: "oklch(0.38 0.008 240)" }} />
          </button>
        </div>

        {/* Nav — plain text, no icons, number prefix */}
        <nav className="flex-1 overflow-y-auto py-3">
          <div
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 9,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "oklch(0.32 0.008 240)",
              padding: "0 16px 8px",
            }}
          >
            Navigation
          </div>
          {NAV_ITEMS.map((item) => {
            const isActive = location === item.path;
            return (
              <Link
                key={item.path}
                href={item.path}
                className="flex items-center gap-0 transition-colors"
                style={{
                  display: "flex",
                  padding: "6px 16px",
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 12,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? "oklch(0.90 0.008 240)" : "oklch(0.48 0.008 240)",
                  background: isActive ? "oklch(0.16 0.01 240)" : "transparent",
                  borderLeft: isActive ? "2px solid oklch(0.52 0.14 250)" : "2px solid transparent",
                  textDecoration: "none",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) (e.currentTarget as HTMLElement).style.color = "oklch(0.70 0.008 240)";
                }}
                onMouseLeave={(e) => {
                  if (!isActive) (e.currentTarget as HTMLElement).style.color = "oklch(0.48 0.008 240)";
                }}
                onClick={() => setMobileOpen(false)}
              >
                <span style={{ color: "oklch(0.30 0.008 240)", marginRight: 8, fontSize: 10 }}>{item.abbr}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer — plain text data sources */}
        <div
          className="px-4 py-3"
          style={{
            borderTop: "1px solid oklch(0.18 0.008 240)",
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 10,
          }}
        >
          <div style={{ color: "oklch(0.40 0.008 240)", fontWeight: 700, marginBottom: 5, letterSpacing: "0.05em", textTransform: "uppercase", fontSize: 9 }}>
            Data Sources
          </div>
          <div style={{ color: "oklch(0.32 0.008 240)", lineHeight: 1.8 }}>
            <div>US Census Bureau ACS</div>
            <div>Redfin Market Tracker</div>
            <div>FRED · St. Louis Fed</div>
            <div>BLS · Bureau of Labor Stats</div>
          </div>
          <div style={{ color: "oklch(0.26 0.008 240)", marginTop: 6, fontSize: 9 }}>
            Pipeline: {pipelineDate}
          </div>
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col lg:ml-[200px] min-w-0 overflow-hidden">

        {/* Top ticker bar */}
        <div
          className="flex items-stretch overflow-x-auto flex-shrink-0"
          style={{ borderBottom: "1px solid var(--border)", background: "var(--card)" }}
        >
          <button
            className="lg:hidden flex items-center px-3"
            style={{ borderRight: "1px solid var(--border)" }}
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="w-4 h-4" />
          </button>

          {/* Page title */}
          <div
            className="flex items-center px-4 flex-shrink-0"
            style={{ borderRight: "1px solid var(--border)", minWidth: 160 }}
          >
            <div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--foreground)" }}>
                {NAV_ITEMS.find(n => n.path === location)?.label ?? "Overview"}
              </div>
              <div className="source-tag">Ohio Real Estate Intelligence</div>
            </div>
          </div>

          {/* Live tickers */}
          <TickerItem label="OH UNEMPLOYMENT" value={fmt(live.ohio_unemployment.value, "", "%", 1)} metric={live.ohio_unemployment} />
          <TickerItem label="OH HOME VALUE" value={fmtK(live.ohio_median_home_value.value)} metric={live.ohio_median_home_value} />
          <TickerItem label="OH MEDIAN RENT" value={fmtK(live.ohio_median_rent.value) + "/mo"} metric={live.ohio_median_rent} />
          <TickerItem label="HOMEOWNERSHIP" value={fmt(live.ohio_homeownership_rate.value, "", "%", 1)} metric={live.ohio_homeownership_rate} />
          <TickerItem label="LISTING PRICE" value={fmtK(live.ohio_listing_price.value)} metric={live.ohio_listing_price} />
          <TickerItem label="30-YR MORTGAGE" value={fmt(live.mortgage_rate_30yr.value, "", "%")} metric={live.mortgage_rate_30yr} />
          <TickerItem label="FED FUNDS" value={fmt(live.fed_funds_rate.value, "", "%")} metric={live.fed_funds_rate} />
          <TickerItem label="OH HPI" value={fmt(live.ohio_hpi.value, "", "", 1)} metric={live.ohio_hpi} />
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto" style={{ background: "var(--background)" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
