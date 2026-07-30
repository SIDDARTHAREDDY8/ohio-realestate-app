/*
 * DashboardLayout — "Market Pro" SaaS shell
 * Deep navy sidebar with branded logo + icon navigation,
 * white top bar with page title and a live KPI strip.
 */

import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Menu, X, Building2, LayoutDashboard, Map, TrendingUp, Brain, BarChart3, Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLiveData, type LiveMetric } from "@/hooks/useLiveData";

const NAV_ITEMS = [
  { path: "/",                    label: "Overview",        icon: LayoutDashboard },
  { path: "/county-explorer",     label: "County Explorer", icon: Map },
  { path: "/market-trends",       label: "Market Trends",   icon: TrendingUp },
  { path: "/ml-insights",         label: "ML Insights",     icon: Brain },
  { path: "/economic-indicators", label: "Economics",       icon: BarChart3 },
  { path: "/about",               label: "About & Data",    icon: Info },
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
            background: "oklch(0.55 0.15 150)",
            flexShrink: 0,
          }} />
        )}
        <span className="source-tag" style={{ fontSize: 10.5 }}>
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

      {/* ── Sidebar ── */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col transition-transform duration-200",
          "w-[236px]",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
        style={{ background: "var(--sidebar)", borderRight: "1px solid var(--sidebar-border)" }}
      >
        {/* Brand */}
        <div className="px-4 py-4 flex items-center gap-3" style={{ borderBottom: "1px solid var(--sidebar-border)" }}>
          <div
            className="flex items-center justify-center flex-shrink-0"
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              background: "linear-gradient(135deg, oklch(0.55 0.19 258), oklch(0.45 0.17 262))",
            }}
          >
            <Building2 className="w-4.5 h-4.5" style={{ width: 18, height: 18, color: "white" }} />
          </div>
          <div className="min-w-0">
            <div style={{ fontSize: 14, fontWeight: 700, color: "white", letterSpacing: "-0.01em", lineHeight: 1.2 }}>
              Ohio Market IQ
            </div>
            <div style={{ fontSize: 11, color: "var(--sidebar-foreground)", opacity: 0.65 }}>
              Real Estate Intelligence
            </div>
          </div>
          <button className="absolute top-4 right-3 lg:hidden" onClick={() => setMobileOpen(false)}>
            <X className="w-4 h-4" style={{ color: "var(--sidebar-foreground)" }} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-2.5">
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--sidebar-foreground)",
              opacity: 0.5,
              padding: "0 12px 8px",
            }}
          >
            Analytics
          </div>
          <div className="space-y-0.5">
            {NAV_ITEMS.map((item) => {
              const isActive = location === item.path;
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className="flex items-center gap-2.5 transition-colors"
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    fontSize: 13.5,
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? "white" : "var(--sidebar-foreground)",
                    background: isActive ? "var(--sidebar-accent)" : "transparent",
                    textDecoration: "none",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) (e.currentTarget as HTMLElement).style.background = "oklch(0.27 0.045 258)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent";
                  }}
                  onClick={() => setMobileOpen(false)}
                >
                  <Icon style={{ width: 16, height: 16, opacity: isActive ? 1 : 0.7, flexShrink: 0 }} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Footer */}
        <div className="px-4 py-4" style={{ borderTop: "1px solid var(--sidebar-border)", fontSize: 11.5 }}>
          <div style={{ color: "var(--sidebar-foreground)", opacity: 0.55, fontWeight: 600, marginBottom: 6, letterSpacing: "0.06em", textTransform: "uppercase", fontSize: 10 }}>
            Data Sources
          </div>
          <div style={{ color: "var(--sidebar-foreground)", opacity: 0.75, lineHeight: 1.9 }}>
            <div>US Census Bureau ACS</div>
            <div>Redfin Market Tracker</div>
            <div>FRED · St. Louis Fed</div>
            <div>BLS · Labor Statistics</div>
          </div>
          <div style={{ color: "var(--sidebar-foreground)", opacity: 0.5, marginTop: 8, fontSize: 10.5 }}>
            Data refreshed {pipelineDate}
          </div>
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col lg:ml-[236px] min-w-0 overflow-hidden">

        {/* Top bar: page title + live KPI strip */}
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
            className="flex items-center px-5 flex-shrink-0"
            style={{ borderRight: "1px solid var(--border)", minWidth: 180 }}
          >
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em", color: "var(--foreground)" }}>
                {NAV_ITEMS.find(n => n.path === location)?.label ?? "Overview"}
              </div>
              <div className="source-tag">Ohio Real Estate Intelligence</div>
            </div>
          </div>

          {/* Live KPI strip */}
          <TickerItem label="Unemployment" value={fmt(live.ohio_unemployment.value, "", "%", 1)} metric={live.ohio_unemployment} />
          <TickerItem label="Home Value" value={fmtK(live.ohio_median_home_value.value)} metric={live.ohio_median_home_value} />
          <TickerItem label="Median Rent" value={fmtK(live.ohio_median_rent.value) + "/mo"} metric={live.ohio_median_rent} />
          <TickerItem label="Homeownership" value={fmt(live.ohio_homeownership_rate.value, "", "%", 1)} metric={live.ohio_homeownership_rate} />
          <TickerItem label="Listing Price" value={fmtK(live.ohio_listing_price.value)} metric={live.ohio_listing_price} />
          <TickerItem label="30-Yr Mortgage" value={fmt(live.mortgage_rate_30yr.value, "", "%")} metric={live.mortgage_rate_30yr} />
          <TickerItem label="Fed Funds" value={fmt(live.fed_funds_rate.value, "", "%")} metric={live.fed_funds_rate} />
          <TickerItem label="Ohio HPI" value={fmt(live.ohio_hpi.value, "", "", 1)} metric={live.ohio_hpi} />
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto" style={{ background: "var(--background)" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
