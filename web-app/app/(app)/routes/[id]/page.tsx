"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { JwCard } from "@/components/JwCard";
import { api } from "@/lib/api-client";
import { pct, usd } from "@/lib/format";

type RouteRes = {
  route: {
    id: string;
    origin: string;
    destination: string;
    distance: number;
    hub: string | null;
    demand: { y: number; j: number; f: number };
    current: {
      aircraft: { type: string; config: { y: number; j: number; f: number } }[];
      weekly_profit_per_week?: number;
      demand_fulfilled_pct?: number;
    };
    optimized: {
      fleet_mix: {
        type: string;
        config: { y: number; j: number; f: number };
        trips_per_week: number;
        profit_per_flight: number;
        profit_per_week: number;
      }[];
      marginal_a330_value: number;
      marginal_a380_value: number;
      scheduling: {
        flight_time_hours: number;
        trips_per_week: number;
        trip_bracket: number;
        threshold_proximity_minutes: number;
      };
      total_profit_per_week: number;
      demand_fulfilled_optimized: number;
    };
    comparison: {
      delta_per_week: number;
      current_demand_fulfilled: number;
      optimized_demand_fulfilled: number;
    };
  };
};

export default function RouteDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const router = useRouter();
  const [data, setData] = useState<RouteRes | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setErr(null);
    try {
      const j = await api<RouteRes>(`/api/routes/${id}`);
      setData(j);
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  useEffect(() => {
    void load();
  }, [id]);

  async function remove() {
    if (!confirm("Delete this route?")) return;
    await api(`/api/routes/${id}`, { method: "DELETE" });
    router.push("/routes");
  }

  async function persistOpt() {
    await api(`/api/routes/${id}/optimize`, { method: "POST" });
    await load();
  }

  if (err || !data) {
    return (
      <JwCard title="Route" subtitle={err ? String(err) : "Loading"}>
        {err ? <p className="text-sm text-orange-400">{err}</p> : <p className="text-sm text-zinc-500">…</p>}
      </JwCard>
    );
  }

  const r = data.route;
  const opt = r.optimized;
  const comp = r.comparison;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs uppercase tracking-widest text-zinc-500">{r.hub ?? "Unassigned hub"}</p>
          <h1 className="mt-1 font-mono text-2xl text-white">
            {r.origin} → {r.destination}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">{Math.round(r.distance)} km</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void persistOpt()}
            className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-sm text-cyan-100"
          >
            Persist optimization
          </button>
          <Link
            href={`/routes/new?edit=${r.id}`}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300"
          >
            Edit
          </Link>
          <button
            type="button"
            onClick={() => void remove()}
            className="rounded-lg border border-orange-500/30 px-3 py-1.5 text-sm text-orange-300"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <JwCard title="Demand" subtitle="Y / J / F seat demand">
          <p className="font-mono text-cyan-100">
            Y {r.demand.y} · J {r.demand.j} · F {r.demand.f}
          </p>
        </JwCard>
        <JwCard title="Comparison" subtitle="Current vs optimized (weekly)">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-zinc-500">Current</dt>
              <dd className="font-mono">{usd(r.current.weekly_profit_per_week ?? 0)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500">Optimized</dt>
              <dd className="font-mono text-emerald-300">{usd(opt.total_profit_per_week)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500">Delta</dt>
              <dd className="font-mono">{usd(comp.delta_per_week)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500">Demand fulfilled</dt>
              <dd className="font-mono">
                {pct(comp.current_demand_fulfilled)} → {pct(comp.optimized_demand_fulfilled)}
              </dd>
            </div>
          </dl>
        </JwCard>
      </div>

      <JwCard title="Scheduling" subtitle="Bottleneck view (min trips in mix)">
        <p className="text-sm text-zinc-300">
          One-way time {opt.scheduling.flight_time_hours.toFixed(2)}h · trips / wk {opt.scheduling.trips_per_week} ·
          bracket {opt.scheduling.trip_bracket} · next threshold {opt.scheduling.threshold_proximity_minutes} min
        </p>
      </JwCard>

      <JwCard title="Marginal aircraft" subtitle="Value of +1 frame on this leg (5-fleet analysis)">
        <p className="text-sm">
          A330: <span className="font-mono text-cyan-200">{usd(opt.marginal_a330_value)}</span> · A380:{" "}
          <span className="font-mono text-cyan-200">{usd(opt.marginal_a380_value)}</span>
        </p>
      </JwCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <JwCard title="Current assignment" subtitle="Sequentially served demand">
          <ul className="space-y-2 text-sm">
            {r.current.aircraft.length ? (
              r.current.aircraft.map((a, i) => (
                <li key={i} className="rounded-lg border border-zinc-800 bg-black/30 p-3 font-mono text-xs text-zinc-200">
                  {a.type} — Y{a.config.y} J{a.config.j} F{a.config.f}
                </li>
              ))
            ) : (
              <p className="text-sm text-zinc-500">No airframes assigned</p>
            )}
          </ul>
        </JwCard>
        <JwCard title="Optimized mix" subtitle="Backbone fleet search (≤4)">
          <ul className="space-y-2 text-sm">
            {opt.fleet_mix.length ? (
              opt.fleet_mix.map((a, i) => (
                <li
                  key={i}
                  className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3 text-xs text-cyan-100"
                >
                  <div className="font-mono">
                    {a.type} — Y{a.config.y} J{a.config.j} F{a.config.f}
                  </div>
                  <div className="mt-1 text-zinc-400">
                    {a.trips_per_week} trips/wk · {usd(a.profit_per_week)}/wk
                  </div>
                </li>
              ))
            ) : (
              <p className="text-sm text-zinc-500">No profitable mix in model</p>
            )}
          </ul>
        </JwCard>
      </div>
    </div>
  );
}
