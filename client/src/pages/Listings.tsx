/*
 * Listings — county-level listing market activity from Redfin Market Tracker.
 * Latest month per county: list/sale prices, inventory, months of supply,
 * days on market, sale-to-list dynamics. Market aggregates, not individual homes.
 */

import { useMemo, useState } from "react";
import { Search, ArrowUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import redfin from "@/data/redfin_county_market.json";
import { cn } from "@/lib/utils";

const rows = redfin as any[];

interface CountyListing {
  county: string;
  period: string;
  listPrice: number | null;
  salePrice: number | null;
  inventory: number | null;
  monthsSupply: number | null;
  dom: number | null;
  saleToList: number | null;
  aboveList: number | null;
  priceDrops: number | null;
  listYoy: number | null;
}

const latest: CountyListing[] = (() => {
  const byCounty = new Map<string, any>();
  for (const r of rows) {
    const key = r.region as string;
    const cur = byCounty.get(key);
    if (!cur || r.period_begin > cur.period_begin) byCounty.set(key, r);
  }
  // Same-month-12mo-ago list price per county, for derived YoY
  const listByKey = new Map<string, number>();
  for (const r of rows) {
    if (r.median_list_price != null) listByKey.set(`${r.region}|${r.period_begin}`, r.median_list_price);
  }
  function yearAgo(period: string): string {
    const y = Number(period.slice(0, 4)) - 1;
    return `${y}${period.slice(4)}`;
  }
  return Array.from(byCounty.values()).map(r => {
    let listYoy: number | null = null;
    const cur = r.median_list_price;
    const past = listByKey.get(`${r.region}|${yearAgo(r.period_begin)}`);
    if (cur != null && past != null && past > 0) listYoy = ((cur - past) / past) * 100;
    return {
      county: (r.region as string).replace(/, OH$/, ""),
      period: r.period_begin,
      listPrice: r.median_list_price ?? null,
      salePrice: r.median_sale_price ?? null,
      inventory: r.inventory ?? null,
      monthsSupply: r.months_of_supply ?? null,
      dom: r.median_dom ?? null,
      saleToList: r.avg_sale_to_list ?? null,
      aboveList: r.sold_above_list != null ? r.sold_above_list * 100 : null,
      priceDrops: r.price_drops != null ? r.price_drops * 100 : null,
      listYoy,
    };
  });
})();

const PERIOD = latest[0]?.period?.slice(0, 7) ?? "";

function fmtK(n: number | null | undefined) {
  if (n == null) return "—";
  return `$${Math.round(n / 1000)}K`;
}
function fmtInt(n: number | null | undefined) {
  if (n == null) return "—";
  return Math.round(n).toLocaleString("en-US");
}
function fmt1(n: number | null | undefined) {
  if (n == null) return "—";
  return n.toFixed(1);
}
function fmtPct(n: number | null | undefined, dec = 1) {
  if (n == null) return "—";
  return `${n.toFixed(dec)}%`;
}

type SortKey = "county" | "listPrice" | "salePrice" | "inventory" | "monthsSupply" | "dom" | "saleToList" | "aboveList" | "priceDrops" | "listYoy";

const COLUMNS: { key: SortKey; label: string; num: boolean }[] = [
  { key: "county", label: "County", num: false },
  { key: "listPrice", label: "List Price", num: true },
  { key: "salePrice", label: "Sale Price", num: true },
  { key: "inventory", label: "Inventory", num: true },
  { key: "monthsSupply", label: "Mo. Supply", num: true },
  { key: "dom", label: "DOM", num: true },
  { key: "saleToList", label: "Sale/List", num: true },
  { key: "aboveList", label: "Above List", num: true },
  { key: "priceDrops", label: "Price Drops", num: true },
  { key: "listYoy", label: "List YoY", num: true },
];

function cell(c: CountyListing, key: SortKey): string {
  switch (key) {
    case "county": return c.county;
    case "listPrice": return fmtK(c.listPrice);
    case "salePrice": return fmtK(c.salePrice);
    case "inventory": return fmtInt(c.inventory);
    case "monthsSupply": return fmt1(c.monthsSupply);
    case "dom": return c.dom == null ? "—" : `${Math.round(c.dom)}`;
    case "saleToList": return c.saleToList == null ? "—" : `${(c.saleToList * 100).toFixed(1)}%`;
    case "aboveList": return fmtPct(c.aboveList);
    case "priceDrops": return fmtPct(c.priceDrops);
    case "listYoy": return c.listYoy == null ? "—" : `${c.listYoy > 0 ? "+" : ""}${c.listYoy.toFixed(1)}%`;
  }
}

function HeroCard({ title, county, value, sub }: { title: string; county: string; value: string; sub: string }) {
  return (
    <div className="panel">
      <div className="section-header">
        <span className="section-title">{title}</span>
      </div>
      <div className="p-4">
        <div className="text-2xl font-bold tabular-nums">{value}</div>
        <div className="mt-1 text-sm font-medium">{county}</div>
        <div className="source-tag">{sub}</div>
      </div>
    </div>
  );
}

export default function Listings() {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("inventory");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? latest.filter(c => c.county.toLowerCase().includes(q)) : [...latest];
    list.sort((a, b) => {
      const av = a[sortKey]; const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "string") return sortDir * av.localeCompare(bv as string);
      return sortDir * ((av as number) - (bv as number));
    });
    return list;
  }, [query, sortKey, sortDir]);

  const fastest = useMemo(() => [...latest].filter(c => c.dom != null).sort((a, b) => (a.dom as number) - (b.dom as number))[0], []);
  const mostInv = useMemo(() => [...latest].filter(c => c.inventory != null).sort((a, b) => (b.inventory as number) - (a.inventory as number))[0], []);
  const hottest = useMemo(() => [...latest].filter(c => c.listYoy != null).sort((a, b) => (b.listYoy as number) - (a.listYoy as number))[0], []);

  function toggle(key: SortKey) {
    if (key === sortKey) setSortDir(d => (d === 1 ? -1 : 1));
    else { setSortKey(key); setSortDir(key === "county" ? 1 : -1); }
  }

  return (
    <div className="p-4 space-y-4">
      {/* ── Executive Header ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-3 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Listings Market</h1>
          <p className="text-sm text-muted-foreground mt-1">
            County-level listing activity across Ohio — list prices, live inventory, and how fast homes move ({PERIOD}).
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="badge-cached">Redfin · {PERIOD}</span>
        </div>
      </div>

      {/* ── Highlights ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {fastest && <HeroCard title="Fastest-Moving Market" county={fastest.county} value={`${Math.round(fastest.dom as number)} days`} sub="Median days on market" />}
        {mostInv && <HeroCard title="Deepest Inventory" county={mostInv.county} value={fmtInt(mostInv.inventory)} sub="Active listings" />}
        {hottest && <HeroCard title="Strongest List-Price Growth" county={hottest.county} value={`+${(hottest.listYoy as number).toFixed(1)}%`} sub="Median list price, year over year" />}
      </div>

      {/* ── Search ── */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search counties…"
          aria-label="Search counties"
          className="pl-9"
        />
      </div>

      {/* ── Table ── */}
      <div className="panel">
        <div className="section-header">
          <span className="section-title">All Counties ({filtered.length})</span>
          <span className="source-tag">Redfin Market Tracker · {PERIOD}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table min-w-[900px]">
            <thead>
              <tr>
                {COLUMNS.map(col => (
                  <th key={col.key} className={cn(col.num && "!text-right")}>
                    <button
                      onClick={() => toggle(col.key)}
                      className="inline-flex items-center gap-1 hover:text-foreground"
                      aria-label={`Sort by ${col.label}`}
                    >
                      {col.label}
                      <ArrowUpDown className={cn("h-3 w-3", sortKey === col.key ? "opacity-80" : "opacity-30")} />
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.county}>
                  {COLUMNS.map(col => (
                    <td key={col.key} className={cn(col.num ? "mono !text-right" : "font-medium", col.key === "county" && "font-semibold")}>
                      {col.key === "listYoy" && c.listYoy != null ? (
                        <span className={c.listYoy >= 0 ? "text-[oklch(0.42_0.14_145)]" : "text-[oklch(0.50_0.18_25)]"}>{cell(c, col.key)}</span>
                      ) : col.key === "dom" && c.dom != null && c.dom <= 21 ? (
                        <span className="font-semibold text-[oklch(0.42_0.14_145)]">{cell(c, col.key)}</span>
                      ) : (
                        cell(c, col.key)
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="source-tag">
        Source: Redfin Market Tracker, county-level monthly data (latest: {PERIOD}). Figures are market aggregates —
        median list prices, active inventory, and selling speed — not individual home listings. Individual property
        listings come from MLS feeds, which require a licensed data agreement.
      </p>
    </div>
  );
}
