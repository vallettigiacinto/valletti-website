"use client";

import { useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/client";

/**
 * Visitor statistics: visits and page views per day and per country,
 * counted by components/VisitTracker.tsx + app/api/track/route.ts.
 * Readable only by admins (RLS on page_views_daily).
 */

type Row = { day: string; country: string; views: number; visits: number };

const PERIODS = [
  { days: 7, label: "Last 7 days" },
  { days: 30, label: "Last 30 days" },
  { days: 90, label: "Last 3 months" },
  { days: 365, label: "Last 12 months" },
];

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

function countryName(code: string) {
  if (code === "XX") return "Unknown";
  try {
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}

function flag(code: string) {
  if (!/^[A-Z]{2}$/.test(code) || code === "XX") return "🌐";
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

function isoDay(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function AdminStatisticsPage() {
  const [days, setDays] = useState(30);
  const [rows, setRows] = useState<Row[]>([]);
  // The period whose rows are currently loaded; while it differs from
  // the selected one, the numbers are still loading.
  const [loadedSince, setLoadedSince] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const since = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1));
    return isoDay(d);
  }, [days]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;
    createClient()
      .from("page_views_daily")
      .select("day, country, views, visits")
      .gte("day", since)
      .order("day")
      .then(({ data, error }) => {
        if (cancelled) return;
        setError(error ? error.message : null);
        setRows((data as Row[]) ?? []);
        setLoadedSince(since);
      });
    return () => {
      cancelled = true;
    };
  }, [since]);

  const loading = isSupabaseConfigured && loadedSince !== since;

  const totals = useMemo(
    () => rows.reduce((t, r) => ({ views: t.views + r.views, visits: t.visits + r.visits }), { views: 0, visits: 0 }),
    [rows]
  );

  const byCountry = useMemo(() => {
    const map = new Map<string, { views: number; visits: number }>();
    for (const r of rows) {
      const c = map.get(r.country) ?? { views: 0, visits: 0 };
      c.views += r.views;
      c.visits += r.visits;
      map.set(r.country, c);
    }
    return [...map.entries()]
      .map(([country, v]) => ({ country, ...v }))
      .sort((a, b) => b.visits - a.visits || b.views - a.views);
  }, [rows]);

  // One bar per day (or per month for the 12-month view), including empty days.
  const timeline = useMemo(() => {
    const monthly = days > 90;
    const buckets = new Map<string, number>();
    const start = new Date(since + "T00:00:00");
    for (let d = new Date(start); isoDay(d) <= isoDay(new Date()); d.setDate(d.getDate() + 1)) {
      const key = monthly ? isoDay(d).slice(0, 7) : isoDay(d);
      buckets.set(key, 0);
    }
    for (const r of rows) {
      const key = monthly ? r.day.slice(0, 7) : r.day;
      if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + r.visits);
    }
    return { monthly, items: [...buckets.entries()] };
  }, [rows, since, days]);

  const maxBar = Math.max(1, ...timeline.items.map(([, v]) => v));
  const maxCountry = Math.max(1, ...byCountry.map((c) => c.visits));

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="font-serif text-3xl text-black">Visitors</h1>
          <p className="text-ink/60 text-sm max-w-xl">
            How many people visit the website and which countries they come from.
            No cookies are used and no personal data is stored — only daily totals
            per country.
          </p>
        </div>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="border border-black/20 bg-white px-3 py-2 text-sm"
        >
          {PERIODS.map((p) => (
            <option key={p.days} value={p.days}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      {!isSupabaseConfigured && (
        <div className="bg-neutral-100 border border-neutral-300 p-5 text-sm">
          Visitor statistics are only collected on the live website (Supabase is not
          configured here).
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-5 text-sm mb-6">
          Could not load the statistics: {error}
        </div>
      )}

      {isSupabaseConfigured && !error && (
        <>
          <div className="grid sm:grid-cols-3 gap-4 mb-8">
            <Stat label="Visits" value={loading ? "…" : totals.visits.toLocaleString("en")} />
            <Stat label="Pages viewed" value={loading ? "…" : totals.views.toLocaleString("en")} />
            <Stat label="Countries" value={loading ? "…" : String(byCountry.filter((c) => c.country !== "XX").length)} />
          </div>

          <div className="bg-white border border-black/10 p-6 mb-8">
            <h2 className="font-medium mb-4">Visits per {timeline.monthly ? "month" : "day"}</h2>
            <div className="flex items-end gap-[2px] h-40">
              {timeline.items.map(([key, value]) => (
                <div
                  key={key}
                  title={`${key}: ${value} visit${value === 1 ? "" : "s"}`}
                  className="flex-1 bg-[#5c1a2b] min-h-[2px] hover:opacity-70"
                  style={{ height: `${(value / maxBar) * 100}%` }}
                />
              ))}
            </div>
            <div className="flex justify-between text-xs text-ink/50 mt-2">
              <span>{timeline.items[0]?.[0]}</span>
              <span>{timeline.items[timeline.items.length - 1]?.[0]}</span>
            </div>
          </div>

          <div className="bg-white border border-black/10 p-6">
            <h2 className="font-medium mb-4">Countries</h2>
            {!loading && byCountry.length === 0 && (
              <p className="text-sm text-ink/60">No visitors counted in this period yet.</p>
            )}
            <table className="w-full text-sm">
              {byCountry.length > 0 && (
                <thead>
                  <tr className="text-left text-ink/50 border-b border-black/10">
                    <th className="py-2 font-normal">Country</th>
                    <th className="py-2 font-normal w-1/3"></th>
                    <th className="py-2 font-normal text-right">Visits</th>
                    <th className="py-2 font-normal text-right">Pages viewed</th>
                  </tr>
                </thead>
              )}
              <tbody>
                {byCountry.map((c) => (
                  <tr key={c.country} className="border-b border-black/5">
                    <td className="py-2">
                      <span className="mr-2">{flag(c.country)}</span>
                      {countryName(c.country)}
                    </td>
                    <td className="py-2 pr-4">
                      <div className="h-2 bg-[#5c1a2b]/80" style={{ width: `${(c.visits / maxCountry) * 100}%` }} />
                    </td>
                    <td className="py-2 text-right tabular-nums">{c.visits.toLocaleString("en")}</td>
                    <td className="py-2 text-right tabular-nums">{c.views.toLocaleString("en")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-black/10 rounded-sm p-5">
      <div className="text-3xl font-serif text-black">{value}</div>
      <div className="text-sm text-ink/60">{label}</div>
    </div>
  );
}
