/*
 * Affordability Calculator — can you afford a home in this Ohio county?
 * Inputs: income, county (prefills median price), down payment, rate, term.
 * Ohio assumptions: 1.52% effective property tax, $150/mo insurance,
 * 0.5%/yr PMI when down payment < 20%. 28% front-end DTI rule.
 */

import { useState, useMemo } from "react";
import { Calculator } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import countySummary from "@/data/county_summary.json";
import kpis from "@/data/kpis.json";
import { cn } from "@/lib/utils";

const counties = countySummary as any[];
const byFips = new Map(counties.map(c => [c.county_fips, c]));
const DEFAULT_RATE = (kpis as any).mortgage_rate_30yr ?? 6.66;

const TAX_RATE = 0.0152;      // Ohio avg effective property tax
const INSURANCE_MO = 150;     // homeowner's insurance estimate
const PMI_RATE = 0.005;       // annual PMI when down < 20%

function money(n: number) {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

function monthlyPI(principal: number, annualRate: number, years: number) {
  if (principal <= 0) return 0;
  const r = annualRate / 100 / 12;
  const n = years * 12;
  if (r === 0) return principal / n;
  return principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

export default function Affordability() {
  const [income, setIncome] = useState(85000);
  const [fips, setFips] = useState("39049"); // Franklin County
  const [downPct, setDownPct] = useState(20);
  const [rate, setRate] = useState(DEFAULT_RATE);
  const [term, setTerm] = useState(30);

  const county = byFips.get(fips);
  const price = county?.median_home_value_2023 ?? 200000;

  const calc = useMemo(() => {
    const down = price * (downPct / 100);
    const loan = price - down;
    const pi = monthlyPI(loan, rate, term);
    const tax = (price * TAX_RATE) / 12;
    const ins = INSURANCE_MO;
    const pmi = downPct < 20 ? (loan * PMI_RATE) / 12 : 0;
    const total = pi + tax + ins + pmi;
    const dti = income > 0 ? (total / (income / 12)) * 100 : 0;
    // Max price at 28% DTI, holding other inputs fixed (iterative approx)
    let maxPrice = price;
    if (income > 0) {
      const target = (income / 12) * 0.28;
      // solve: total(p) <= target — linear-ish, iterate
      let lo = 0, hi = price * 4 + 500000;
      for (let i = 0; i < 40; i++) {
        const mid = (lo + hi) / 2;
        const d = mid * (downPct / 100);
        const l = mid - d;
        const t = monthlyPI(l, rate, term) + (mid * TAX_RATE) / 12 + INSURANCE_MO
          + (downPct < 20 ? (l * PMI_RATE) / 12 : 0);
        if (t <= target) lo = mid; else hi = mid;
      }
      maxPrice = lo;
    }
    return { down, loan, pi, tax, ins, pmi, total, dti, maxPrice };
  }, [income, price, downPct, rate, term]);

  const verdict =
    calc.dti <= 28 ? { label: "Affordable", cls: "bg-[oklch(0.48_0.16_145)/0.12] text-[oklch(0.42_0.14_145)] border-[oklch(0.48_0.16_145)/0.3]" } :
    calc.dti <= 36 ? { label: "Stretch", cls: "bg-[oklch(0.65_0.15_80)/0.12] text-[oklch(0.55_0.14_80)] border-[oklch(0.65_0.15_80)/0.35]" } :
                     { label: "Unaffordable", cls: "bg-[oklch(0.55_0.20_25)/0.10] text-[oklch(0.50_0.18_25)] border-[oklch(0.55_0.20_25)/0.3]" };

  const parts = [
    { label: "Principal & Interest", value: calc.pi, color: "oklch(0.55 0.16 250)" },
    { label: "Property Tax", value: calc.tax, color: "oklch(0.62 0.18 35)" },
    { label: "Insurance", value: calc.ins, color: "oklch(0.48 0.16 145)" },
    ...(calc.pmi > 0 ? [{ label: "PMI", value: calc.pmi, color: "oklch(0.55 0.20 25)" }] : []),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Calculator className="w-7 h-7 text-[oklch(0.55_0.16_250)]" />
          Affordability Calculator
        </h1>
        <p className="text-muted-foreground mt-1 text-sm sm:text-base">
          See what a typical home costs per month in any Ohio county — and whether it fits your income.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Your Inputs</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">County</label>
              <Select value={fips} onValueChange={setFips}>
                <SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {counties.map(c => (
                    <SelectItem key={c.county_fips} value={c.county_fips}>{c.county_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Median home value: <span className="font-semibold text-foreground">{money(price)}</span>
              </p>
            </div>

            <div>
              <div className="flex justify-between items-baseline">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Annual Household Income
                </label>
                <span className="font-bold tabular-nums">{money(income)}</span>
              </div>
              <Slider className="mt-2" min={20000} max={300000} step={5000}
                      value={[income]} onValueChange={v => setIncome(v[0])} />
            </div>

            <div>
              <div className="flex justify-between items-baseline">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Down Payment
                </label>
                <span className="font-bold tabular-nums">{downPct}% · {money(price * downPct / 100)}</span>
              </div>
              <Slider className="mt-2" min={0} max={50} step={1}
                      value={[downPct]} onValueChange={v => setDownPct(v[0])} />
              {downPct < 20 && (
                <p className="text-xs text-muted-foreground mt-1">PMI included (under 20% down).</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between items-baseline">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Rate</label>
                  <span className="font-bold tabular-nums">{rate.toFixed(2)}%</span>
                </div>
                <Slider className="mt-2" min={3} max={10} step={0.125}
                        value={[rate]} onValueChange={v => setRate(v[0])} />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Term</label>
                <Select value={String(term)} onValueChange={v => setTerm(Number(v))}>
                  <SelectTrigger className="mt-2 w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30-year fixed</SelectItem>
                    <SelectItem value="15">15-year fixed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Monthly Payment</CardTitle>
              <Badge variant="outline" className={cn("text-sm font-bold", verdict.cls)}>
                {verdict.label}
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold tabular-nums">{money(calc.total)}
                <span className="text-base font-normal text-muted-foreground">/mo</span>
              </div>

              <div className="flex h-3 rounded-full overflow-hidden mt-4">
                {parts.map(p => (
                  <div key={p.label} style={{ width: `${(p.value / calc.total) * 100}%`, background: p.color }}
                       title={`${p.label}: ${money(p.value)}`} />
                ))}
              </div>
              <div className="mt-3 space-y-1.5">
                {parts.map(p => (
                  <div key={p.label} className="flex justify-between text-sm">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <span className="w-2.5 h-2.5 rounded-sm" style={{ background: p.color }} />
                      {p.label}
                    </span>
                    <span className="font-semibold tabular-nums">{money(p.value)}</span>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3 mt-5 pt-4 border-t">
                <div>
                  <div className="text-xs text-muted-foreground">Housing / Income (DTI)</div>
                  <div className={cn("text-2xl font-bold tabular-nums",
                    calc.dti <= 28 ? "text-[oklch(0.42_0.14_145)]" :
                    calc.dti <= 36 ? "text-[oklch(0.55_0.14_80)]" : "text-[oklch(0.50_0.18_25)]")}>
                    {calc.dti.toFixed(1)}%
                  </div>
                  <div className="text-xs text-muted-foreground">Lenders like ≤ 28%</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Max Affordable Price</div>
                  <div className="text-2xl font-bold tabular-nums">{money(calc.maxPrice)}</div>
                  <div className="text-xs text-muted-foreground">At 28% of your income</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground space-y-1">
              <p><span className="font-semibold text-foreground">Assumptions:</span> 30-yr fixed at {rate.toFixed(2)}% (FRED 30-yr avg {DEFAULT_RATE.toFixed(2)}%), {county?.county_name ?? ""} median price {money(price)}.</p>
              <p>Property tax {TAX_RATE * 100}%/yr (Ohio average effective rate), insurance {money(INSURANCE_MO)}/mo, PMI {PMI_RATE * 100}%/yr under 20% down. Estimate only — not a loan offer.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
