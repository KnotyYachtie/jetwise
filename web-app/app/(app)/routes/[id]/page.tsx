"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { JwCard } from "@/components/JwCard";
import { api } from "@/lib/api-client";
import { pct, usd } from "@/lib/format";
import { MAX_AIRCRAFT_PER_ROUTE } from "@/lib/optimizer";

type TripCostBreakdown = {
  fuel: number;
  co2: number;
  acheck: number;
  repair: number;
  total: number;
};

type FleetEconomicsRow = {
  type: string;
  config: { y: number; j: number; f: number };
  trips_per_week: number;
  flight_time_hours: number;
  revenue_per_flight: number;
  cost_per_flight: number;
  cost_breakdown: TripCostBreakdown;
  profit_per_flight: number;
  profit_per_hour: number;
  profit_per_week: number;
};

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
      economics_rows: FleetEconomicsRow[];
      weekly_profit_per_week?: number;
      demand_fulfilled_pct?: number;
    };
    optimized: {
      fleet_mix: FleetEconomicsRow[];
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

/** Rotation-weighted averages across aircraft lines (same math as blended weekly totals ÷ rotations). */
function weightedTripEconomics(rows: FleetEconomicsRow[]) {
  const rotations = rows.reduce((s, r) => s + r.trips_per_week, 0);
  if (rotations <= 0) return null;
  const weighted = (pick: (r: FleetEconomicsRow) => number) =>
    rows.reduce((s, r) => s + pick(r) * r.trips_per_week, 0) / rotations;
  return {
    rotations_per_week: rotations,
    gross_per_trip: weighted((r) => r.revenue_per_flight),
    net_per_trip: weighted((r) => r.profit_per_flight),
    cost_per_trip: weighted((r) => r.cost_per_flight),
    breakdown: {
      fuel: weighted((r) => r.cost_breakdown.fuel),
      co2: weighted((r) => r.cost_breakdown.co2),
      acheck: weighted((r) => r.cost_breakdown.acheck),
      repair: weighted((r) => r.cost_breakdown.repair),
    },
  };
}

function fleetTypeSummary(rows: FleetEconomicsRow[]): string {
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.type, (m.get(r.type) ?? 0) + 1);
  return [...m.entries()].map(([t, n]) => `${t}×${n}`).join(" · ") || "—";
}

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

  const currentTripBlend = weightedTripEconomics(currentRows);
  const optimizedTripBlend = weightedTripEconomics(optimizedRows);

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

      <JwCard title="Route economics (current assignment)" subtitle="Weekly totals plus rotation-weighted per-trip figures">
        <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Stat title="Revenue / wk" value={usd(currentRevenuePerWeek)} />
          <Stat title="Cost / wk" value={usd(currentCostPerWeek)} />
          <Stat title="Profit / wk" value={usd(r.current.weekly_profit_per_week ?? 0)} />
          <Stat title="Profit / flight-hour" value={usd(currentProfitPerHour)} />
        </div>
        {currentTripBlend ? (
          <div className="mt-4 rounded-lg border border-zinc-800/80 bg-black/25 p-4">
            <p className="text-[10px] uppercase tracking-widest text-zinc-500">
              Per trip (weighted by {currentTripBlend.rotations_per_week.toFixed(0)} rotations / wk)
            </p>
            <div className="mt-2 grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-[10px] text-zinc-500">Gross / trip</p>
                <p className="font-mono text-sm text-zinc-200">Ticket revenue (Y+J+F)</p>
                <p className="mt-1 font-mono text-cyan-100">{usd(currentTripBlend.gross_per_trip)}</p>
              </div>
              <div>
                <p className="text-[10px] text-zinc-500">Cost / trip</p>
                <p className="font-mono text-sm text-zinc-200">Operating total</p>
                <p className="mt-1 font-mono text-zinc-300">{usd(currentTripBlend.cost_per_trip)}</p>
                <TripCostParts bd={currentTripBlend.breakdown} />
              </div>
              <div>
                <p className="text-[10px] text-zinc-500">Net / trip</p>
                <p className="font-mono text-sm text-zinc-200">Profit after operating costs</p>
                <p className="mt-1 font-mono text-emerald-200/90">{usd(currentTripBlend.net_per_trip)}</p>
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-zinc-500">Assign aircraft to see per-trip breakdown.</p>
        )}
        <p className="mt-3 text-[10px] text-zinc-500">
          Gross = ticket revenue per rotation; net = gross − operating cost (fuel, CO₂ charges, amortized checks,
          repair reserve). Weekly figures multiply per-trip values by rotations/week per airframe and sum across your
          fleet lines.
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
        <p className="mt-3 text-[11px] leading-relaxed text-zinc-400">
          Most of this gap is explained by{" "}
          <span className="text-zinc-300">capacity vs demand</span>: the optimizer proposes{" "}
          <span className="font-mono text-zinc-300">{optimizedRows.length}</span> deployed line
          {optimizedRows.length === 1 ? "" : "s"} with cabin mixes that lift fulfillment (
          {pct(comp.current_demand_fulfilled)} → {pct(comp.optimized_demand_fulfilled)}). Compare your assignment below
          to <span className="text-cyan-200/90">Optimized mix</span> — same airport pair and schedule bracket; changes are
          fleet count + seatmaps per aircraft type.
        </p>
        {optimizedTripBlend ? (
          <div className="mt-4 rounded-lg border border-cyan-500/15 bg-cyan-500/[0.04] p-4">
            <p className="text-[10px] uppercase tracking-widest text-cyan-200/70">
              Optimized scenario — per trip (weighted · {optimizedTripBlend.rotations_per_week.toFixed(0)} rot/wk)
            </p>
            <div className="mt-2 grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-[10px] text-zinc-500">Gross / trip</p>
                <p className="mt-1 font-mono text-sm text-cyan-50">{usd(optimizedTripBlend.gross_per_trip)}</p>
              </div>
              <div>
                <p className="text-[10px] text-zinc-500">Cost / trip</p>
                <p className="mt-1 font-mono text-sm text-zinc-300">{usd(optimizedTripBlend.cost_per_trip)}</p>
                <TripCostParts bd={optimizedTripBlend.breakdown} accent="cyan" />
              </div>
              <div>
                <p className="text-[10px] text-zinc-500">Net / trip</p>
                <p className="mt-1 font-mono text-sm text-emerald-200/90">{usd(optimizedTripBlend.net_per_trip)}</p>
              </div>
            </div>
          </div>
        ) : null}
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

      <JwCard
        title="Marginal aircraft"
        subtitle={`Extra weekly profit if one more aircraft could be added profitably vs the optimized baseline (deploy cap ${MAX_AIRCRAFT_PER_ROUTE} frames). Near zero means demand is saturated or the extra frame cannot earn positive marginal trips in this model.`}
      >
        <p className="text-sm">
          A330: <span className="font-mono text-cyan-200">{usd(opt.marginal_a330_value)}</span> · A380:{" "}
          <span className="font-mono text-cyan-200">{usd(opt.marginal_a380_value)}</span>
        </p>
      </JwCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <JwCard title="Current assignment (your input)" subtitle="Each line’s cabin layout with full trip economics">
          <ul className="space-y-3 text-sm">
            {currentRows.length ? (
              currentRows.map((a, i) => (
                <FleetLineDetail key={i} row={a} variant="muted" />
              ))
            ) : (
              <p className="text-sm text-zinc-500">No airframes assigned</p>
            )}
          </ul>
        </JwCard>
        <JwCard
          title="Optimized mix (system recommendation)"
          subtitle={`${fleetTypeSummary(optimizedRows)} — fleet size maximizes modeled weekly profit; each aircraft then fills an equal partition of Y/J/F demand so parallel hulls stay similarly configured`}
        >
          <ul className="space-y-3 text-sm">
            {opt.fleet_mix.length ? (
              opt.fleet_mix.map((a, i) => <FleetLineDetail key={i} row={a} variant="optimized" />)
            ) : (
              <p className="text-sm text-zinc-500">No profitable mix in model</p>
            )}
          </ul>
        </JwCard>
      </div>
    </div>
  );
}

function TripCostParts({
  bd,
  accent = "zinc",
}: {
  bd: { fuel: number; co2: number; acheck: number; repair: number };
  accent?: "zinc" | "cyan";
}) {
  const val = accent === "cyan" ? "text-cyan-100/90" : "text-zinc-300";
  return (
    <ul className="mt-2 space-y-1 border-t border-zinc-800/80 pt-2 text-[11px] text-zinc-500">
      <li className="flex justify-between gap-3">
        <span>Fuel</span>
        <span className={`font-mono ${val}`}>{usd(bd.fuel)}</span>
      </li>
      <li className="flex justify-between gap-3">
        <span>CO₂</span>
        <span className={`font-mono ${val}`}>{usd(bd.co2)}</span>
      </li>
      <li className="flex justify-between gap-3">
        <span>A-check amort.</span>
        <span className={`font-mono ${val}`}>{usd(bd.acheck)}</span>
      </li>
      <li className="flex justify-between gap-3">
        <span>Repair reserve</span>
        <span className={`font-mono ${val}`}>{usd(bd.repair)}</span>
      </li>
    </ul>
  );
}

function FleetLineDetail({ row, variant }: { row: FleetEconomicsRow; variant: "muted" | "optimized" }) {
  const wrap =
    variant === "optimized"
      ? "rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3 text-cyan-50"
      : "rounded-lg border border-zinc-800 bg-black/30 p-3 text-zinc-200";
  const sub = "text-zinc-400";
  const bd = row.cost_breakdown;
  return (
    <li className={`${wrap} font-mono text-xs`}>
      <div className="text-sm text-white/90">
        {row.type} — Y{row.config.y} J{row.config.j} F{row.config.f}
      </div>
      <div className={`mt-1 ${sub}`}>
        {row.trips_per_week} trips/wk · {row.flight_time_hours.toFixed(2)}h block · {usd(row.profit_per_hour)}/hr
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-500">Gross / trip</p>
          <p className="mt-0.5 font-mono text-sm text-zinc-100">{usd(row.revenue_per_flight)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-500">Cost / trip</p>
          <p className="mt-0.5 font-mono text-sm">{usd(row.cost_per_flight)}</p>
          <TripCostParts
            bd={{ fuel: bd.fuel, co2: bd.co2, acheck: bd.acheck, repair: bd.repair }}
            accent={variant === "optimized" ? "cyan" : "zinc"}
          />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-500">Net / trip</p>
          <p className="mt-0.5 font-mono text-sm text-emerald-200/90">{usd(row.profit_per_flight)}</p>
        </div>
      </div>
    </li>
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
