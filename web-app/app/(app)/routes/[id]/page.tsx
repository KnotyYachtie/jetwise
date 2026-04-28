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
    prices: { y: number; j: number; f: number };
    current: {
      aircraft: { type: string; config: { y: number; j: number; f: number } }[];
      economics_rows: {
        type: string;
        config: { y: number; j: number; f: number };
        trips_per_week: number;
        flight_time_hours: number;
        revenue_per_flight: number;
        cost_per_flight: number;
        profit_per_flight: number;
        profit_per_hour: number;
        profit_per_week: number;
      }[];
      weekly_profit_per_week?: number;
      demand_fulfilled_pct?: number;
    };
    optimized: {
      fleet_mix: {
        type: string;
        config: { y: number; j: number; f: number };
        trips_per_week: number;
        flight_time_hours: number;
        revenue_per_flight: number;
        cost_per_flight: number;
        profit_per_flight: number;
        profit_per_hour: number;
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

type RouteListBench = {
  id: string;
  current: { weekly_profit_per_week?: number };
  optimized: { total_profit_per_week: number };
};

export default function RouteDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const router = useRouter();
  const [data, setData] = useState<RouteRes | null>(null);
  const [allRoutes, setAllRoutes] = useState<RouteListBench[]>([]);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setErr(null);
    try {
      const j = await api<RouteRes>(`/api/routes/${id}`);
      setData(j);
      const list = await api<{ routes: RouteListBench[] }>("/api/routes");
      setAllRoutes(list.routes ?? []);
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
  const currentRows = r.current.economics_rows ?? [];
  const optimizedRows = opt.fleet_mix ?? [];

  const currentRevenuePerWeek = currentRows.reduce(
    (sum, row) => sum + row.revenue_per_flight * row.trips_per_week,
    0
  );
  const currentCostPerWeek = currentRows.reduce(
    (sum, row) => sum + row.cost_per_flight * row.trips_per_week,
    0
  );
  const currentFlightHoursPerWeek = currentRows.reduce(
    (sum, row) => sum + row.flight_time_hours * row.trips_per_week,
    0
  );
  const currentProfitPerHour =
    currentFlightHoursPerWeek > 0 ? (r.current.weekly_profit_per_week ?? 0) / currentFlightHoursPerWeek : 0;

  const optimizedRevenuePerWeek = optimizedRows.reduce(
    (sum, row) => sum + row.revenue_per_flight * row.trips_per_week,
    0
  );
  const optimizedCostPerWeek = optimizedRows.reduce(
    (sum, row) => sum + row.cost_per_flight * row.trips_per_week,
    0
  );
  const optimizedFlightHoursPerWeek = optimizedRows.reduce(
    (sum, row) => sum + row.flight_time_hours * row.trips_per_week,
    0
  );
  const optimizedProfitPerHour =
    optimizedFlightHoursPerWeek > 0 ? opt.total_profit_per_week / optimizedFlightHoursPerWeek : 0;
  const configLeakPerWeek = (opt.total_profit_per_week ?? 0) - (r.current.weekly_profit_per_week ?? 0);

  const sortableCurrent = allRoutes
    .map((x) => ({ id: x.id, value: x.current?.weekly_profit_per_week ?? 0 }))
    .sort((a, b) => b.value - a.value);
  const sortableOptimized = allRoutes
    .map((x) => ({ id: x.id, value: x.optimized?.total_profit_per_week ?? 0 }))
    .sort((a, b) => b.value - a.value);
  const currentRank = sortableCurrent.findIndex((x) => x.id === r.id) + 1;
  const optimizedRank = sortableOptimized.findIndex((x) => x.id === r.id) + 1;
  const routeCount = Math.max(allRoutes.length, 1);
  const currentRankLabel = currentRank > 0 ? `#${currentRank}/${routeCount}` : "—";
  const optimizedRankLabel = optimizedRank > 0 ? `#${optimizedRank}/${routeCount}` : "—";

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

      <JwCard title="Route economics (current input first)" subtitle="This is what your currently assigned aircraft mix is doing">
        <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Stat title="Revenue / wk" value={usd(currentRevenuePerWeek)} />
          <Stat title="Cost / wk" value={usd(currentCostPerWeek)} />
          <Stat title="Profit / wk" value={usd(r.current.weekly_profit_per_week ?? 0)} />
          <Stat title="Profit / flight-hour" value={usd(currentProfitPerHour)} />
        </div>
        <p className="mt-3 text-[10px] text-zinc-500">
          Profit is computed as <span className="font-mono text-zinc-400">revenue − cost</span> per flight, scaled by
          trips/week (costs are non‑negative operating totals).
        </p>
      </JwCard>

      <JwCard title="Optimization opportunity" subtitle="How much weekly profit your current configuration is leaking">
        <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Stat title="Optimized profit / wk" value={usd(opt.total_profit_per_week)} />
          <Stat title="Current config leak / wk" value={usd(configLeakPerWeek)} highlight />
          <Stat title="Optimized profit / flight-hour" value={usd(optimizedProfitPerHour)} />
          <Stat
            title="Demand fulfilled"
            value={`${pct(comp.current_demand_fulfilled)} → ${pct(comp.optimized_demand_fulfilled)}`}
          />
        </div>
      </JwCard>

      <JwCard title="Route competitiveness" subtitle="How this route ranks against the rest of your network">
        <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Stat title="Current profit rank" value={currentRankLabel} />
          <Stat title="Optimized profit rank" value={optimizedRankLabel} />
          <Stat title="Delta vs current" value={usd(comp.delta_per_week)} highlight />
          <Stat title="Trips / week (optimized)" value={String(opt.scheduling.trips_per_week)} />
        </div>
      </JwCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <JwCard title="Demand + ticket model" subtitle="Inputs used by the economics model">
          <p className="font-mono text-cyan-100">
            Demand: Y {r.demand.y} · J {r.demand.j} · F {r.demand.f}
          </p>
          <p className="mt-2 font-mono text-zinc-300">
            Prices: Y {usd(r.prices.y)} · J {usd(r.prices.j)} · F {usd(r.prices.f)}
          </p>
        </JwCard>
        <JwCard title="Scheduling pressure" subtitle="Useful for spotting under-rotated / over-long legs">
          <p className="text-sm text-zinc-300">
            One-way time {opt.scheduling.flight_time_hours.toFixed(2)}h · trips / wk {opt.scheduling.trips_per_week} ·
            bracket {opt.scheduling.trip_bracket} · next threshold {opt.scheduling.threshold_proximity_minutes} min
          </p>
        </JwCard>
      </div>

      <JwCard title="Marginal aircraft" subtitle="Value of +1 frame on this leg (5-fleet analysis)">
        <p className="text-sm">
          A330: <span className="font-mono text-cyan-200">{usd(opt.marginal_a330_value)}</span> · A380:{" "}
          <span className="font-mono text-cyan-200">{usd(opt.marginal_a380_value)}</span>
        </p>
      </JwCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <JwCard title="Current assignment (your input)" subtitle="Shows where current config is subpar">
          <ul className="space-y-2 text-sm">
            {currentRows.length ? (
              currentRows.map((a, i) => (
                <li key={i} className="rounded-lg border border-zinc-800 bg-black/30 p-3 font-mono text-xs text-zinc-200">
                  <div>
                    {a.type} — Y{a.config.y} J{a.config.j} F{a.config.f}
                  </div>
                  <div className="mt-1 text-zinc-400">
                    {a.trips_per_week} trips/wk · rev {usd(a.revenue_per_flight)}/flt · cost{" "}
                    {usd(a.cost_per_flight)}/flt · profit {usd(a.profit_per_hour)}/hr
                  </div>
                </li>
              ))
            ) : (
              <p className="text-sm text-zinc-500">No airframes assigned</p>
            )}
          </ul>
        </JwCard>
        <JwCard title="Optimized mix (system recommendation)" subtitle="Profit-max route configuration while keeping aircraft hourly-profitable">
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
                    {a.trips_per_week} trips/wk · rev {usd(a.revenue_per_flight)}/flt · cost{" "}
                    {usd(a.cost_per_flight)}/flt · profit {usd(a.profit_per_hour)}/hr
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

function Stat({
  title,
  value,
  highlight = false,
}: {
  title: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-lg border border-zinc-800/80 bg-black/20 p-3">
      <p className="text-[10px] uppercase tracking-widest text-zinc-500">{title}</p>
      <p className={highlight ? "mt-1 font-mono text-cyan-200" : "mt-1 font-mono text-zinc-200"}>{value}</p>
    </div>
  );
}
