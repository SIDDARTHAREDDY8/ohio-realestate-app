/**
 * useLiveData — fetches live data from CORS-enabled public APIs
 *
 * Live sources (no API key required):
 *   - US Census Bureau ACS 5-Year API (api.census.gov) — housing metrics
 *   - BLS Public Data API v1 (api.bls.gov) — Ohio unemployment rate
 *
 * Static sources (from last pipeline run):
 *   - FRED economic indicators (mortgage rate, HPI, fed funds, listing price)
 *   - These update monthly via GitHub Actions
 *
 * Design decision: no "CACHED" labels. Static data shows source + date.
 * Live data shows source + "as of [date]". Both are real data.
 */

import { useState, useEffect } from "react";
import staticKpis from "@/data/kpis.json";
import staticMeta from "@/data/pipeline_meta.json";

const kpis = staticKpis as any;
const meta = staticMeta as any;

// BLS series IDs
const BLS_OHIO_UNEMPLOYMENT = "LASST390000000000003"; // Ohio statewide unemployment

// Census ACS variables for Ohio state-level
const CENSUS_VARS = "B25077_001E,B25064_001E,B19013_001E,B25003_002E,B25003_001E";
const CENSUS_URL = `https://api.census.gov/data/2023/acs/acs5?get=NAME,${CENSUS_VARS}&for=state:39`;

export interface LiveMetric {
  value: number | null;
  date: string | null;
  source: string;
  isLive: boolean;
}

export interface LiveData {
  // Live from BLS
  ohio_unemployment: LiveMetric;
  // Live from Census ACS
  ohio_median_home_value: LiveMetric;
  ohio_median_rent: LiveMetric;
  ohio_median_income: LiveMetric;
  ohio_homeownership_rate: LiveMetric;
  // Static from FRED (updated monthly by pipeline)
  mortgage_rate_30yr: LiveMetric;
  ohio_listing_price: LiveMetric;
  ohio_hpi: LiveMetric;
  fed_funds_rate: LiveMetric;
  ohio_active_listings: LiveMetric;
  // Meta
  isLoading: boolean;
  lastPipelineRun: string | null;
  fetchedAt: string | null;
}

async function fetchBLSUnemployment(): Promise<{ value: number; date: string } | null> {
  try {
    const url = `https://api.bls.gov/publicAPI/v1/timeseries/data/${BLS_OHIO_UNEMPLOYMENT}?startyear=2025&endyear=2026`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const series = data?.Results?.series?.[0];
    const latest = series?.data?.[0];
    if (!latest) return null;
    const monthMap: Record<string, string> = {
      M01:"Jan",M02:"Feb",M03:"Mar",M04:"Apr",M05:"May",M06:"Jun",
      M07:"Jul",M08:"Aug",M09:"Sep",M10:"Oct",M11:"Nov",M12:"Dec"
    };
    const month = monthMap[latest.period] ?? latest.period;
    return {
      value: parseFloat(latest.value),
      date: `${month} ${latest.year}${latest.footnotes?.[0]?.code === "P" ? " (prelim.)" : ""}`,
    };
  } catch {
    return null;
  }
}

async function fetchCensusOhio(): Promise<{
  median_home_value: number;
  median_rent: number;
  median_income: number;
  homeownership_rate: number;
} | null> {
  try {
    const res = await fetch(CENSUS_URL);
    if (!res.ok) return null;
    const data = await res.json();
    // data[0] = headers, data[1] = Ohio values
    const headers: string[] = data[0];
    const vals: string[] = data[1];
    const get = (key: string) => parseFloat(vals[headers.indexOf(key)] ?? "0") || null;

    const totalUnits = get("B25003_001E") ?? 1;
    const ownerOccupied = get("B25003_002E") ?? 0;

    return {
      median_home_value: get("B25077_001E") ?? 0,
      median_rent: get("B25064_001E") ?? 0,
      median_income: get("B19013_001E") ?? 0,
      homeownership_rate: Math.round((ownerOccupied / totalUnits) * 1000) / 10,
    };
  } catch {
    return null;
  }
}

const STATIC_DATE = meta.last_refresh
  ? new Date(meta.last_refresh).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  : "May 2026";

export function useLiveData(): LiveData {
  const [data, setData] = useState<LiveData>({
    ohio_unemployment: {
      value: kpis.unemployment_rate ?? null,
      date: STATIC_DATE,
      source: "BLS",
      isLive: false,
    },
    ohio_median_home_value: {
      value: kpis.statewide?.avg_home_value ?? null,
      date: "ACS 5-yr (latest)",
      source: "Census ACS",
      isLive: false,
    },
    ohio_median_rent: {
      value: kpis.statewide?.avg_rent ?? null,
      date: "ACS 5-yr (latest)",
      source: "Census ACS",
      isLive: false,
    },
    ohio_median_income: {
      value: null,
      date: "ACS 5-yr (latest)",
      source: "Census ACS",
      isLive: false,
    },
    ohio_homeownership_rate: {
      value: kpis.statewide?.avg_homeownership_rate ?? null,
      date: "ACS 5-yr (latest)",
      source: "Census ACS",
      isLive: false,
    },
    mortgage_rate_30yr: {
      value: kpis.mortgage_rate_30yr ?? null,
      date: STATIC_DATE,
      source: "FRED · MORTGAGE30US",
      isLive: false,
    },
    ohio_listing_price: {
      value: kpis.latest_listing_price ?? null,
      date: STATIC_DATE,
      source: "FRED · MEDLISPRIOH",
      isLive: false,
    },
    ohio_hpi: {
      value: kpis.hpi ?? null,
      date: STATIC_DATE,
      source: "FRED · OHSTHPI",
      isLive: false,
    },
    fed_funds_rate: {
      value: kpis.fed_funds_rate ?? null,
      date: STATIC_DATE,
      source: "FRED · FEDFUNDS",
      isLive: false,
    },
    ohio_active_listings: {
      value: kpis.ohio_active_listings ?? null,
      date: STATIC_DATE,
      source: "FRED · ACTLISCOUOH",
      isLive: false,
    },
    isLoading: true,
    lastPipelineRun: meta.last_refresh ?? null,
    fetchedAt: null,
  });

  useEffect(() => {
    const fetchLive = async () => {
      const [blsResult, censusResult] = await Promise.allSettled([
        fetchBLSUnemployment(),
        fetchCensusOhio(),
      ]);

      setData(prev => {
        const next = { ...prev, isLoading: false, fetchedAt: new Date().toISOString() };

        if (blsResult.status === "fulfilled" && blsResult.value) {
          next.ohio_unemployment = {
            value: blsResult.value.value,
            date: blsResult.value.date,
            source: "BLS",
            isLive: true,
          };
        } else {
          next.ohio_unemployment = { ...prev.ohio_unemployment, isLoading: false } as any;
        }

        if (censusResult.status === "fulfilled" && censusResult.value) {
          const c = censusResult.value;
          // 2023 ACS 5-Year is the latest available (released Dec 2024)
          // Census publishes with ~12-month lag — no 2024/2025 data exists yet
          const acsLabel = "2023 ACS 5-yr";
          next.ohio_median_home_value = { value: c.median_home_value, date: acsLabel, source: "Census ACS", isLive: true };
          next.ohio_median_rent = { value: c.median_rent, date: acsLabel, source: "Census ACS", isLive: true };
          next.ohio_median_income = { value: c.median_income, date: acsLabel, source: "Census ACS", isLive: true };
          next.ohio_homeownership_rate = { value: c.homeownership_rate, date: acsLabel, source: "Census ACS", isLive: true };
        }

        return next;
      });
    };

    fetchLive();
  }, []);

  return data;
}
