/*
 * Investor Scorecard — rank all 88 Ohio counties for buy-and-hold investors.
 * Score blends gross rental yield (40%), 5-yr appreciation (35%),
 * and price-to-rent ratio (25%, lower is better).
 */

import { useState, useMemo } from "react";
import { Search, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import countySummary from "@/data/county_summary.json";
import { cn } from "@/lib/utils";

const raw = countySummary as any[];

interface Scored {
  county_fips: string;
  county_name: string;
  region: string;
  median_home_value_2023: number | null;
  median_rent_2023: number | null;
  home_value_5yr_change: number | null;
  grossYield: number | null;
  priceToRent: number | null;
  score: number;
}

function norm(v: number | null, min: number, max: number) {
  if (v == null || !Number.isFinite(v) || max <= min) return 0;
  return Math.min(1, Math.max(0, (v - min) / (max - min)));
}

function scoreAll(): Scored[] {
  const rows = raw.map(c => {
    const val = c.median_home_value_2023;
    const rent = c.median_rent_2023;
    const grossYield = val && rent ? (rent * 12 / val) * 100 : null;
    const priceToRent = val && rent ? val / rent : null;
    return { ...c, grossYield, priceToRent };
  }).filter(c => c.grossYield != null && c.home_value_5yr_change != null && c.priceToRent != null);

  const ys = rows.map(r => r.grossYield);
  const as = rows.map(r => r.home_value_5yr_change);
  const ps = rows.map(r => r.priceToRent);
  const yMin = Math.min(...ys), yMax = Math.max(...ys);
  const aMin = Math.min(...as), aMax = Math.max(...as);
  const pMin = Math.min(...ps), pMax = Math.max(...ps);

  return rows.map(r => ({
    county_fips: r.county_fips,
    county_name: r.county_name,
    region: r.region,
    median_home_value_2023: r.median_home_value_2023,
    median_rent_2023: r.median_rent_2023,
    home_value_5yr_change: r.home_value_5yr_change,
    grossYield: r.grossYield,
    priceToRent: r.priceToRent,
    score: Math.round(
      100 * (0.40 * norm(r.grossYield, yMin, yMax)
           + 0.35 * norm(r.home_value_5yr_change, aMin, aMax)
           + 0.25 * (1 - norm(r.priceToRent, pMin, pMax)))
    ),
  })).sort((a, b) => b.score - a.score);
}

const REGIONS = ["All Regions", "Central", "Northeast", "Southwest", "Northwest", "Southeast"];
type SortKey = "score" | "grossYield" | "home_value_5yr_change" | "priceToRent" | "median_home_value_2023";

function scoreColor(s: number) {
  if (s >= 70) return "bg-[oklch(0.48_0.16_145)/0.12] text-[oklch(0.42_0.14_145)] border-[oklch(0.48_0.16_145)/0.35]";
  if (s >= 50) return "bg-[oklch(0.55_0.16_250)/0.10] text-[oklch(0.50_0.14_250)] border-[oklch(0.55_0.16_250)/0.3]";
  return "bg-muted text-muted-foreground border-border";
}

export default function InvestorScorecard() {
  const [search, setSearch] = useState("");
  const [region, setRegion] = useState("All Regions");
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const scored = useMemo(scoreAll, []);

  const filtered = useMemo(() => {
    let data = [...scored];
    if (search) data = data.filter(c => c.county_name.toLowerCase().includes(search.toLowerCase()));
    if (region !== "All Regions") data = data.filter(c => c.region === region);
    data.sort((a, b) => {
      const av = a[sortKey] ?? 0, bv = b[sortKey] ?? 0;
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return data;
  }, [scored, search, region, sortKey, sortDir]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("desc"); }
  }
  function SI({ k }: { k: SortKey }) {
    if (sortKey !== k) return <ArrowUpDown className="w-3 h-3 inline opacity-30 ml-1" />;
    return sortDir === "asc"
      ? <ArrowUp className="w-3 h-3 inline ml-1" /> : <ArrowDown className="w-3 h-3 inline ml-1" />;
  }

  const top3 = scored.slice(0, 3);

  return (
    <div className="p-4 space-y-4">
      {/* ── Executive Header ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-3 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Investor Scorecard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Every Ohio county ranked for buy-and-hold investors — gross rental yield, 5-year appreciation,
            and price-to-rent blended into one score.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="badge-cached">Census ACS · 2023 5-yr</span>
        </div>
      </div>

      {/* ── Top 3 ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {top3.map((c, i) => (
          <div key={c.county_fips} className="panel">
            <div className="section-header">
              <span className="section-title">Rank #{i + 1}</span>
              <Badge variant="outline" className={cn("tabular-nums font-bold", scoreColor(c.score))}>
                {c.score}
              </Badge>
            </div>
            <div className="p-4">
              <div className="font-bold text-lg">{c.county_name}</div>
              <div className="text-xs text-muted-foreground">{c.region} Ohio</div>
              <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                <div>
                  <div className="text-xs text-muted-foreground">Yield</div>
                  <div className="font-bold tabular-nums">{c.grossYield!.toFixed(1)}%</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">5-Yr Appr.</div>
                  <div className="font-bold tabular-nums">{c.home_value_5yr_change!.toFixed(1)}%</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">P/R Ratio</div>
                  <div className="font-bold tabular-nums">{c.priceToRent!.toFixed(1)}x</div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search counties…" value={search}
                 onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={region} onValueChange={setRegion}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            {REGIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* ── Rankings table ── */}
      <div className="panel">
        <div className="section-header">
          <span className="section-title">All Counties Ranked ({filtered.length})</span>
          <span className="source-tag">Census ACS 2023</span>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table min-w-[640px]">
            <thead>
              <tr>
                <th className="w-14">#</th>
                <th className="cursor-pointer select-none hover:text-foreground" onClick={() => toggleSort("score")}>County</th>
                <th className="cursor-pointer select-none hover:text-foreground" onClick={() => toggleSort("score")}>Score<SI k="score" /></th>
                <th className="cursor-pointer select-none hover:text-foreground" onClick={() => toggleSort("grossYield")}>Gross Yield<SI k="grossYield" /></th>
                <th className="cursor-pointer select-none hover:text-foreground" onClick={() => toggleSort("home_value_5yr_change")}>5-Yr Appr.<SI k="home_value_5yr_change" /></th>
                <th className="cursor-pointer select-none hover:text-foreground" onClick={() => toggleSort("priceToRent")}>Price/Rent<SI k="priceToRent" /></th>
                <th className="cursor-pointer select-none hover:text-foreground" onClick={() => toggleSort("median_home_value_2023")}>Home Value<SI k="median_home_value_2023" /></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => (
                <tr key={c.county_fips}>
                  <td className="tabular-nums text-muted-foreground">{i + 1}</td>
                  <td className="font-semibold">{c.county_name}
                    <span className="block text-xs font-normal text-muted-foreground">{c.region}</span>
                  </td>
                  <td>
                    <Badge variant="outline" className={cn("tabular-nums font-bold", scoreColor(c.score))}>
                      {c.score}
                    </Badge>
                  </td>
                  <td className="mono font-semibold">{c.grossYield!.toFixed(1)}%</td>
                  <td className="mono">{c.home_value_5yr_change!.toFixed(1)}%</td>
                  <td className="mono">{c.priceToRent!.toFixed(1)}x</td>
                  <td className="mono">${Math.round(c.median_home_value_2023! / 1000)}K</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="source-tag">
        Score = 40% gross rental yield + 35% 5-yr appreciation + 25% price-to-rent (inverted),
        min-max normalized across counties. Based on Census ACS 2023. Educational use only — not investment advice.
      </p>
    </div>
  );
}
