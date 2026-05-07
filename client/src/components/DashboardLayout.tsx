/* Ohio Blueprint Design System
   DashboardLayout: Dark navy sidebar + white main canvas
   Sidebar: 260px fixed, dark (#0F172A), Ohio state blue accents
   Main: Scrollable content area with blueprint grid background
*/

import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Map,
  TrendingUp,
  Brain,
  BarChart3,
  Info,
  Menu,
  X,
  Building2,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import pipelineMeta from "@/data/pipeline_meta.json";

const NAV_ITEMS = [
  { path: "/", label: "Overview", icon: LayoutDashboard, description: "Statewide KPIs & summary" },
  { path: "/county-explorer", label: "County Explorer", icon: Map, description: "88-county deep dive" },
  { path: "/market-trends", label: "Market Trends", icon: TrendingUp, description: "Redfin market data" },
  { path: "/ml-insights", label: "ML Insights", icon: Brain, description: "Predictions & clusters" },
  { path: "/economic-indicators", label: "Economic Data", icon: BarChart3, description: "FRED indicators" },
  { path: "/about", label: "About & Data", icon: Info, description: "Sources & methodology" },
];

const meta = pipelineMeta as {
  last_refresh: string;
  data_sources: string[];
  counties_covered: number;
  refresh_schedule: string;
};

function formatRefreshDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso.substring(0, 10);
  }
}

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col transition-transform duration-300 ease-in-out",
          "w-[260px]",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
        style={{ backgroundColor: "oklch(0.13 0.025 255)" }}
      >
        {/* Logo / Brand */}
        <div className="flex items-center gap-3 px-5 py-5 border-b" style={{ borderColor: "oklch(0.22 0.03 255)" }}>
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: "oklch(0.45 0.18 255)" }}
          >
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold leading-tight" style={{ color: "oklch(0.95 0.01 240)", fontFamily: "'DM Sans', sans-serif" }}>
              Ohio RE
            </div>
            <div className="text-xs leading-tight" style={{ color: "oklch(0.55 0.02 240)" }}>
              Market Intelligence
            </div>
          </div>
          <button
            className="ml-auto lg:hidden p-1 rounded"
            style={{ color: "oklch(0.55 0.02 240)" }}
            onClick={() => setMobileOpen(false)}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <div className="text-xs font-semibold uppercase tracking-wider mb-3 px-3" style={{ color: "oklch(0.42 0.02 240)" }}>
            Analytics
          </div>
          {NAV_ITEMS.map((item) => {
            const isActive = location === item.path;
            return (
              <Link
                key={item.path}
                href={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-150 group",
                  isActive ? "text-white" : "hover:text-white"
                )}
                style={{
                  backgroundColor: isActive ? "oklch(0.45 0.18 255)" : "transparent",
                  color: isActive ? "white" : "oklch(0.65 0.02 240)",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.backgroundColor = "oklch(0.20 0.03 255)";
                    (e.currentTarget as HTMLElement).style.color = "oklch(0.92 0.01 240)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
                    (e.currentTarget as HTMLElement).style.color = "oklch(0.65 0.02 240)";
                  }
                }}
                onClick={() => setMobileOpen(false)}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1">{item.label}</span>
                {isActive && <ChevronRight className="w-3 h-3 opacity-60" />}
              </Link>
            );
          })}
        </nav>

        {/* Data sources + refresh footer */}
        <div className="px-4 py-4 border-t space-y-3" style={{ borderColor: "oklch(0.22 0.03 255)" }}>
          {/* Last refresh badge */}
          <div
            className="flex items-center gap-2 px-2.5 py-2 rounded-lg"
            style={{ backgroundColor: "oklch(0.18 0.03 255)" }}
          >
            <RefreshCw className="w-3 h-3 flex-shrink-0" style={{ color: "oklch(0.55 0.18 255)" }} />
            <div className="min-w-0">
              <div className="text-xs font-semibold" style={{ color: "oklch(0.55 0.18 255)" }}>
                Auto-refresh
              </div>
              <div className="text-xs" style={{ color: "oklch(0.45 0.02 240)" }}>
                {formatRefreshDate(meta.last_refresh)}
              </div>
            </div>
          </div>

          {/* Data sources */}
          <div className="text-xs" style={{ color: "oklch(0.42 0.02 240)" }}>
            <div className="font-semibold mb-1" style={{ color: "oklch(0.55 0.02 240)" }}>Data Sources</div>
            {meta.data_sources.map(src => (
              <div key={src}>{src}</div>
            ))}
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col lg:ml-[260px] min-w-0 overflow-hidden">
        {/* Top bar */}
        <header
          className="flex items-center gap-4 px-6 py-3 border-b bg-white flex-shrink-0"
          style={{ borderColor: "oklch(0.90 0.008 240)" }}
        >
          <button
            className="lg:hidden p-2 rounded-md hover:bg-muted transition-colors"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-foreground">
              {NAV_ITEMS.find((n) => n.path === location)?.label ?? "Ohio Real Estate Intelligence"}
            </div>
            <div className="text-xs text-muted-foreground">
              {NAV_ITEMS.find((n) => n.path === location)?.description ?? "Market Intelligence Platform"}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1"
              style={{
                backgroundColor: "oklch(0.94 0.015 255)",
                color: "oklch(0.35 0.15 255)",
              }}
            >
              <RefreshCw className="w-2.5 h-2.5" />
              Monthly Auto-Refresh
            </span>
            <span className="text-xs text-muted-foreground hidden sm:block">
              {meta.counties_covered} Ohio Counties
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto blueprint-bg">
          {children}
        </main>
      </div>
    </div>
  );
}
