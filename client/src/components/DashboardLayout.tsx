/*
 * DashboardLayout — Data Terminal style
 * Narrow sidebar (220px), dense top ticker bar, no decorative chrome
 * Every pixel earns its place
 */

import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Map, TrendingUp, Brain, BarChart3, Info,
  Menu, X, Database, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLiveData } from "@/hooks/useLiveData";

const NAV_ITEMS = [
  { path: "/",                    label: "Overview",     icon: LayoutDashboard },
  { path: "/county-explorer",     label: "Counties",     icon: Map },
  { path: "/market-trends",       label: "Market",       icon: TrendingUp },
  { path: "/ml-insights",         label: "ML Models",    icon: Brain },
  { path: "/economic-indicators", label: "Economics",    icon: BarChart3 },
  { path: "/about",               label: "About",        icon: Info },
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
  change?: number | null;
  source: "live" | "cached";
  date?: string | null;
}
function TickerItem({ label, value, change, source, date }: TickerItemProps) {
  const isUp = change != null && change >= 0;
  return (
    <div className="ticker-item">
      <div className="ticker-label">{label}</div>
      <div className={cn("ticker-value", change != null ? (isUp ? "trend-up" : "trend-down") : "")}>
        {value}
      </div>
      <div className="flex items-center gap-1.5 mt-0.5">
        {change != null && (
          <span className={cn("ticker-change", isUp ? "trend-up" : "trend-down")}>
            {isUp ? <ArrowUpRight className="w-2.5 h-2.5 inline" /> : <ArrowDownRight className="w-2.5 h-2.5 inline" />}
            {Math.abs(change).toFixed(2)}
          </span>
        )}
        <span className={source === "live" ? "badge-live" : "badge-cached"}>
          {source === "live" ? "● LIVE" : "CACHED"}
        </span>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const live = useLiveData();

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--background)" }}>

      {/* ── Sidebar ── */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col transition-transform duration-200",
          "w-[220px]",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
        style={{ background: "var(--sidebar)", borderRight: "1px solid var(--sidebar-border)" }}
      >
        {/* Brand — minimal, no logo */}
        <div
          className="flex items-center gap-2 px-4 py-3"
          style={{ borderBottom: "1px solid var(--sidebar-border)" }}
        >
          <Database className="w-4 h-4 flex-shrink-0" style={{ color: "oklch(0.52 0.14 250)" }} />
          <div>
            <div className="text-xs font-bold tracking-tight" style={{ color: "oklch(0.88 0.008 240)", fontFamily: "'IBM Plex Mono', monospace" }}>
              OH-RE-INTEL
            </div>
            <div className="text-xs" style={{ color: "oklch(0.42 0.008 240)", fontSize: 10 }}>
              v2.0 · 88 counties
            </div>
          </div>
          <button className="ml-auto lg:hidden" onClick={() => setMobileOpen(false)}>
            <X className="w-3.5 h-3.5" style={{ color: "oklch(0.42 0.008 240)" }} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-2">
          {NAV_ITEMS.map((item) => {
            const isActive = location === item.path;
            return (
              <Link
                key={item.path}
                href={item.path}
                className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium transition-colors"
                style={{
                  color: isActive ? "oklch(0.88 0.008 240)" : "oklch(0.52 0.008 240)",
                  background: isActive ? "oklch(0.18 0.01 240)" : "transparent",
                  borderLeft: isActive ? "2px solid oklch(0.52 0.14 250)" : "2px solid transparent",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) (e.currentTarget as HTMLElement).style.color = "oklch(0.75 0.008 240)";
                }}
                onMouseLeave={(e) => {
                  if (!isActive) (e.currentTarget as HTMLElement).style.color = "oklch(0.52 0.008 240)";
                }}
                onClick={() => setMobileOpen(false)}
              >
                <item.icon className="w-3.5 h-3.5 flex-shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Data sources — plain text, no icons */}
        <div
          className="px-4 py-3 text-xs"
          style={{ borderTop: "1px solid var(--sidebar-border)", color: "oklch(0.38 0.008 240)", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10 }}
        >
          <div style={{ color: "oklch(0.48 0.008 240)", marginBottom: 4, fontWeight: 600 }}>DATA SOURCES</div>
          <div>US Census Bureau ACS</div>
          <div>Redfin Market Tracker</div>
          <div>FRED · St. Louis Fed</div>
          <div style={{ marginTop: 6, color: "oklch(0.32 0.008 240)" }}>
            {live.apiEnabled ? "● LIVE API" : "○ CACHED"} · {live.lastFetched ? new Date(live.lastFetched).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
          </div>
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col lg:ml-[220px] min-w-0 overflow-hidden">

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
            className="flex items-center px-4"
            style={{ borderRight: "1px solid var(--border)", minWidth: 160 }}
          >
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-foreground">
                {NAV_ITEMS.find(n => n.path === location)?.label ?? "Overview"}
              </div>
              <div className="source-tag">Ohio Real Estate Intelligence</div>
            </div>
          </div>

          {/* Live tickers */}
          <TickerItem
            label="30-YR MORTGAGE"
            value={fmt(live.mortgage_rate_30yr.value, "", "%")}
            source={live.mortgage_rate_30yr.source}
            date={live.mortgage_rate_30yr.date}
          />
          <TickerItem
            label="OH LISTING PRICE"
            value={fmtK(live.ohio_listing_price.value)}
            source={live.ohio_listing_price.source}
            date={live.ohio_listing_price.date}
          />
          <TickerItem
            label="OH UNEMPLOYMENT"
            value={fmt(live.ohio_unemployment.value, "", "%")}
            source={live.ohio_unemployment.source}
            date={live.ohio_unemployment.date}
          />
          <TickerItem
            label="OH HPI"
            value={fmt(live.ohio_hpi.value, "", "", 1)}
            source={live.ohio_hpi.source}
            date={live.ohio_hpi.date}
          />
          <TickerItem
            label="FED FUNDS"
            value={fmt(live.fed_funds_rate.value, "", "%")}
            source={live.fed_funds_rate.source}
            date={live.fed_funds_rate.date}
          />

          {/* Active listings */}
          <TickerItem
            label="OH ACTIVE LISTINGS"
            value={live.ohio_active_listings.value != null ? live.ohio_active_listings.value.toLocaleString("en-US", { maximumFractionDigits: 0 }) : "—"}
            source={live.ohio_active_listings.source}
            date={live.ohio_active_listings.date}
          />
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto" style={{ background: "var(--background)" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
