"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { JwCard } from "@/components/JwCard";
import { shortenAirportHeadline } from "@/lib/airport-display-labels";
import { api } from "@/lib/api-client";
import { usd } from "@/lib/format";

type RouteList = {
  id: string;
  origin: string;
  destination: string;
  origin_airport_name?: string | null;
  destination_airport_name?: string | null;
  distance: number;
  prices: { y: number; j: number; f: number };
  hub: string | null;
  current: { weekly_profit_per_week?: number; aircraft: unknown[] };
  optimized: {
    total_profit_per_week: number;
    scheduling: {
      trips_per_week: number;
      trip_bracket: number;
    };
  };
  comparison: { delta_per_week: number };
};

type Res = { routes: RouteList[] };

export default function RoutesListPage() {
  const [data, setData] = useState<Res | null>(null);
  const [optLoading, setOptLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setErr(null);
    try {
      const j = await api<Res>("/api/routes");
      setData(j);
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function optimizeAll() {
    setOptLoading(true);
    setErr(null);
    try {
      await api("/api/optimize-all", { method: "POST" });
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setOptLoading(false);
    }
  }

  if (err && !data) {
    return (
      <JwCard title="Routes" subtitle="Load error">
        <p className="text-sm text-orange-400">{err}</p>
      </JwCard>
    );
  }

  if (!data) {
    return <div className="h-48 animate-pulse rounded-2xl bg-zinc-900/60 ring-1 ring-cyan-500/10" />;
  }

  const rows = [...data.routes].sort(
    (a, b) => (b.comparison?.delta_per_week ?? 0) - (a.comparison?.delta_per_week ?? 0)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-semibold text-white">Route list</h1>
          <p className="mt-1 text-sm text-zinc-500">Current vs optimized economics — weekly model.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/routes/new"
            className="rounded-xl border border-cyan-500/35 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100"
          >
            New route
          </Link>
          <button
            type="button"
            disabled={optLoading}
            onClick={() => void optimizeAll()}
            className="rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            {optLoading ? "Optimizing…" : "Optimize & persist"}
          </button>
        </div>
      </div>

      {err ? <p className="text-sm text-orange-400">{err}</p> : null}

      <div className="space-y-4">
        {rows.map((r) => {
          const delta = r.comparison?.delta_per_week ?? 0;
          const sched = r.optimized.scheduling;
          return (
            <Link key={r.id} href={`/routes/${r.id}`}>
              <article className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-5 transition hover:border-cyan-500/35 hover:shadow-[0_0_40px_-12px_rgba(34,211,238,0.35)]">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-zinc-500">
                      {r.hub ?? "— hub"}
                    </p>
                    <p className="mt-1 font-mono text-lg text-white">
                      {r.origin} → {r.destination}
                    </p>
                    {r.origin_airport_name || r.destination_airport_name ? (
                      <p className="mt-1 text-xs text-zinc-500">
                        {r.origin_airport_name ? shortenAirportHeadline(r.origin_airport_name) : r.origin} →{" "}
                        {r.destination_airport_name ? shortenAirportHeadline(r.destination_airport_name) : r.destination}
                      </p>
                    ) : null}
                    <p className="mt-1 text-xs text-zinc-500">
                      {Math.round(r.distance)} km · bracket ~{sched?.trip_bracket ?? "—"}/day eq · trips/wk{" "}
                      {sched?.trips_per_week ?? "—"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-widest text-zinc-500">Δ optimized − current</p>
                    <p className={delta >= 0 ? "font-mono text-lg text-emerald-400" : "font-mono text-lg text-orange-400"}>
                      {usd(delta)}
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 border-t border-zinc-800 pt-4 text-sm sm:grid-cols-2">
                  <Stat label="Current / wk" value={usd(r.current?.weekly_profit_per_week ?? 0)} />
                  <Stat label="Optimized / wk" value={usd(r.optimized.total_profit_per_week)} />
                </div>
                <div className="mt-3 text-xs text-zinc-400">
                  Ticket prices · Y {usd(r.prices?.y ?? 0)} · J {usd(r.prices?.j ?? 0)} · F{" "}
                  {usd(r.prices?.f ?? 0)}
                </div>
              </article>
            </Link>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <JwCard title="No routes yet" subtitle="Create your first leg">
          <Link href="/routes/new" className="text-sm text-cyan-300 underline-offset-4 hover:underline">
            Open route composer →
          </Link>
        </JwCard>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-zinc-500">{label}</p>
      <p className="font-mono text-zinc-200">{value}</p>
    </div>
  );
}
