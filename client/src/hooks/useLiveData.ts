/**
 * useLiveData — fetches live economic indicators directly from FRED API
 * Falls back to static JSON if API is unavailable or no key is set.
 *
 * FRED API key: free at https://fred.stlouisfed.org/docs/api/api_key.html
 * Set VITE_FRED_API_KEY in your .env file to enable live data.
 * Without a key, the hook returns the latest values from the static JSON cache.
 */

import { useState, useEffect } from "react";
import staticKpis from "@/data/kpis.json";
import staticMeta from "@/data/pipeline_meta.json";

const FRED_API_KEY = import.meta.env.VITE_FRED_API_KEY as string | undefined;
const FRED_BASE = "https://api.stlouisfed.org/fred/series/observations";

interface LiveMetric {
  value: number | null;
  date: string | null;
  source: "live" | "cached";
  series_id: string;
}

interface LiveData {
  mortgage_rate_30yr: LiveMetric;
  ohio_listing_price: LiveMetric;
  ohio_unemployment: LiveMetric;
  ohio_hpi: LiveMetric;
  fed_funds_rate: LiveMetric;
  ohio_active_listings: LiveMetric;
  isLoading: boolean;
  lastFetched: string | null;
  apiEnabled: boolean;
}

async function fetchFredSeries(seriesId: string): Promise<{ value: number; date: string } | null> {
  if (!FRED_API_KEY) return null;
  try {
    const url = `${FRED_BASE}?series_id=${seriesId}&api_key=${FRED_API_KEY}&file_type=json&sort_order=desc&limit=1`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const obs = data?.observations?.[0];
    if (!obs || obs.value === ".") return null;
    return { value: parseFloat(obs.value), date: obs.date };
  } catch {
    return null;
  }
}

const kpis = staticKpis as any;
const meta = staticMeta as any;

export function useLiveData(): LiveData {
  const apiEnabled = !!FRED_API_KEY;

  const [data, setData] = useState<LiveData>({
    mortgage_rate_30yr: {
      value: kpis.mortgage_rate_30yr ?? null,
      date: null,
      source: "cached",
      series_id: "MORTGAGE30US",
    },
    ohio_listing_price: {
      value: kpis.latest_listing_price ?? null,
      date: null,
      source: "cached",
      series_id: "MEDLISPRIOH",
    },
    ohio_unemployment: {
      value: kpis.unemployment_rate ?? null,
      date: null,
      source: "cached",
      series_id: "OHUR",
    },
    ohio_hpi: {
      value: kpis.hpi ?? null,
      date: null,
      source: "cached",
      series_id: "OHSTHPI",
    },
    fed_funds_rate: {
      value: null,
      date: null,
      source: "cached",
      series_id: "FEDFUNDS",
    },
    ohio_active_listings: {
      value: null,
      date: null,
      source: "cached",
      series_id: "ACTLISCOUOH",
    },
    isLoading: apiEnabled,
    lastFetched: meta.last_refresh ?? null,
    apiEnabled,
  });

  useEffect(() => {
    if (!apiEnabled) return;

    const fetchAll = async () => {
      const series = [
        { key: "mortgage_rate_30yr" as const, id: "MORTGAGE30US" },
        { key: "ohio_listing_price" as const, id: "MEDLISPRIOH" },
        { key: "ohio_unemployment" as const, id: "OHUR" },
        { key: "ohio_hpi" as const, id: "OHSTHPI" },
        { key: "fed_funds_rate" as const, id: "FEDFUNDS" },
        { key: "ohio_active_listings" as const, id: "ACTLISCOUOH" },
      ];

      const results = await Promise.allSettled(
        series.map(({ id }) => fetchFredSeries(id))
      );

      setData((prev) => {
        const next = { ...prev, isLoading: false, lastFetched: new Date().toISOString() };
        results.forEach((result, i) => {
          const { key, id } = series[i];
          if (result.status === "fulfilled" && result.value) {
            (next as any)[key] = {
              value: result.value.value,
              date: result.value.date,
              source: "live" as const,
              series_id: id,
            };
          }
        });
        return next;
      });
    };

    fetchAll();
  }, [apiEnabled]);

  return data;
}
