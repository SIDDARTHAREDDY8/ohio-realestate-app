/*
 * ZipLookup — ZIP-code price pull.
 * Bundled ACS 5-year housing stats for 1,128 Ohio ZCTAs (built from Census
 * table-based summary files, no API key needed, works offline).
 */

import { useState } from "react";
import { MapPin, Search, TriangleAlert } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import zctaStats from "@/data/zcta_stats.json";

const DB = zctaStats as {
  release: string;
  ohio: { v: number | null; r: number | null; i: number | null };
  zips: Record<string, {
    c: string; v: number | null; ve: number | null;
    r: number | null; re: number | null;
    i: number | null; ie: number | null;
    p: number | null; o: number | null;
  }>;
};

interface ZipResult {
  zip: string;
  county: string;
  homeValue: number | null; homeMoe: number | null;
  rent: number | null; rentMoe: number | null;
  income: number | null; incomeMoe: number | null;
  population: number | null; ownership: number | null;
}

function fmtMoney(n: number | null | undefined) {
  if (n == null) return "—";
  return `$${Math.round(n).toLocaleString("en-US")}`;
}
function fmtInt(n: number | null | undefined) {
  if (n == null) return "—";
  return Math.round(n).toLocaleString("en-US");
}
function fmtPct(n: number | null | undefined, dec = 1) {
  if (n == null) return "—";
  return `${n.toFixed(dec)}%`;
}

function Delta({ zip, state, invert = false }: { zip: number | null; state: number | null; invert?: boolean }) {
  if (zip == null || state == null || state === 0) return null;
  const d = ((zip - state) / state) * 100;
  const good = invert ? d < 0 : d > 0;
  return (
    <span className={cn("text-xs font-semibold", good ? "text-[oklch(0.42_0.14_145)]" : "text-muted-foreground")}>
      {d > 0 ? "+" : ""}{d.toFixed(1)}% vs Ohio
    </span>
  );
}

function StatCard({ label, value, moe, delta }: { label: string; value: number | null; moe: number | null; delta?: React.ReactNode }) {
  return (
    <div className="panel">
      <div className="section-header">
        <span className="section-title">{label}</span>
      </div>
      <div className="p-4">
        <div className="text-2xl font-bold tabular-nums">{fmtMoney(value)}</div>
        <div className="mt-1 flex items-center justify-between gap-2">
          <span className="source-tag">{moe != null ? `± ${fmtMoney(moe)} MOE` : "—"}</span>
          {delta}
        </div>
      </div>
    </div>
  );
}

export default function ZipLookup() {
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<ZipResult | null>(null);

  function lookup(rawZip?: string) {
    const zip = (rawZip ?? input).trim();
    setResult(null);
    if (!/^\d{5}$/.test(zip)) {
      setError("Enter a 5-digit ZIP code.");
      return;
    }
    const row = DB.zips[zip];
    if (!row) {
      setError(
        /^(43|44|45)/.test(zip)
          ? `No housing data published for ZIP ${zip}. Some ZIPs (PO boxes, very small areas) aren't covered by the ACS.`
          : "That doesn't look like an Ohio ZIP code — Ohio ZIPs start with 43, 44, or 45."
      );
      return;
    }
    setError("");
    setResult({
      zip,
      county: row.c,
      homeValue: row.v, homeMoe: row.ve,
      rent: row.r, rentMoe: row.re,
      income: row.i, incomeMoe: row.ie,
      population: row.p, ownership: row.o,
    });
  }

  return (
    <div className="p-4 space-y-4">
      {/* ── Executive Header ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-3 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Zip Code Price Pull</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Census housing stats for any of {Object.keys(DB.zips).length.toLocaleString()} Ohio ZIP codes — median home value, rent, income, and how it stacks up against the state.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="badge-cached">Census ACS · 2024 5-yr</span>
        </div>
      </div>

      {/* ── Search ── */}
      <div className="panel">
        <div className="p-4">
          <form
            className="flex flex-col gap-3 sm:flex-row"
            onSubmit={e => { e.preventDefault(); lookup(); }}
          >
            <Input
              value={input}
              onChange={e => { setInput(e.target.value.replace(/\D/g, "").slice(0, 5)); setError(""); }}
              placeholder="Enter Ohio ZIP — e.g. 45220"
              inputMode="numeric"
              aria-label="ZIP code"
              className="h-12 text-base sm:max-w-xs"
            />
            <Button type="submit" className="h-12 px-6">
              <Search className="h-4 w-4" />
              <span className="ml-2">Pull prices</span>
            </Button>
          </form>
          {error && (
            <p className="mt-3 flex items-start gap-2 text-sm text-red-600">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {error}
            </p>
          )}
        </div>
      </div>

      {!result && !error && (
        <div className="panel">
          <div className="py-12 text-center text-sm text-muted-foreground">
            <MapPin className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
            Type an Ohio ZIP code above to pull its latest housing numbers.
          </div>
        </div>
      )}

      {result && (
        <>
          {/* ── Hero stat ── */}
          <div className="panel">
            <div className="section-header">
              <span className="section-title">
                ZIP {result.zip} · {result.county} County
              </span>
              <span className="source-tag">ACS 2024 5-yr</span>
            </div>
            <div className="p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Median home value</div>
              <div className="mt-1 text-4xl font-bold tabular-nums">{fmtMoney(result.homeValue)}</div>
              <div className="mt-1 source-tag">
                {result.homeMoe != null ? `± ${fmtMoney(result.homeMoe)} margin of error · ` : ""}ACS 2024 5-year
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Median Rent / Mo"
              value={result.rent}
              moe={result.rentMoe}
              delta={<Delta zip={result.rent} state={DB.ohio.r} invert />}
            />
            <StatCard
              label="Median Household Income"
              value={result.income}
              moe={result.incomeMoe}
              delta={<Delta zip={result.income} state={DB.ohio.i} />}
            />
            <div className="panel">
              <div className="section-header">
                <span className="section-title">Population</span>
              </div>
              <div className="p-4">
                <div className="text-2xl font-bold tabular-nums">{fmtInt(result.population)}</div>
                <div className="mt-1 source-tag">ZCTA residents</div>
              </div>
            </div>
            <div className="panel">
              <div className="section-header">
                <span className="section-title">Homeownership</span>
              </div>
              <div className="p-4">
                <div className="text-2xl font-bold tabular-nums">{fmtPct(result.ownership)}</div>
                <div className="mt-1 source-tag">Owner-occupied share</div>
              </div>
            </div>
          </div>

          {/* ── vs Ohio ── */}
          <div className="panel">
            <div className="section-header">
              <span className="section-title">ZIP {result.zip} vs Ohio</span>
              <span className="source-tag">Census ACS 2024</span>
            </div>
            <div className="p-4 space-y-4">
              {[
                { label: "Median home value", zip: result.homeValue, state: DB.ohio.v, invert: true },
                { label: "Median rent", zip: result.rent, state: DB.ohio.r, invert: true },
                { label: "Median income", zip: result.income, state: DB.ohio.i, invert: false },
              ].map(row => {
                if (row.zip == null || row.state == null) return null;
                const pctOf = Math.min(row.zip / row.state, 2);
                const good = row.invert ? row.zip <= row.state : row.zip >= row.state;
                return (
                  <div key={row.label}>
                    <div className="mb-1 flex items-baseline justify-between text-sm">
                      <span className="font-medium">{row.label}</span>
                      <span className="text-muted-foreground">
                        <span className="font-semibold text-foreground tabular-nums">{fmtMoney(row.zip)}</span>
                        {" "}vs {fmtMoney(row.state)} statewide
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(pctOf / 2) * 100}%`,
                          background: good ? "oklch(0.48 0.16 145)" : "oklch(0.65 0.15 80)",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      <p className="source-tag">
        Source: U.S. Census Bureau American Community Survey 2024 5-year estimates (table-based summary files).
        Margins of error at 90% confidence. ZIP Code Tabulation Areas approximate USPS ZIP codes; figures describe residents of the area, not listed homes.
      </p>
    </div>
  );
}
