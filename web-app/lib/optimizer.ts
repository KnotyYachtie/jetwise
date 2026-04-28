import { A380_SPEC, A330_SPEC } from "./aircraft-data";
import type { Aircraft, Company, FlightEconomics, SchedulingInfo } from "./economics";
import {
  demandFulfilledPercent,
  evaluateAircraftOnRoute,
  evaluateWithFixedConfig,
} from "./economics";
import type { CurrentAircraftRow, Demand } from "./types";

/** Maximum aircraft deployed per route in optimizer enumeration (n380 + n330 ≤ this). */
export const MAX_AIRCRAFT_PER_ROUTE = 6;
/** Marginal “+1 hull” probe evaluates fleets up to this size (deploy cap + 1). */
const MAX_AIRCRAFT_MARGINAL_PROBE = MAX_AIRCRAFT_PER_ROUTE + 1;

export type Config = { y: number; j: number; f: number };

export type TripCostBreakdown = {
  fuel: number;
  co2: number;
  acheck: number;
  repair: number;
  total: number;
};

export type FleetMixRow = {
  type: string;
  name: string;
  config: Config;
  trips_per_week: number;
  flight_time_hours: number;
  revenue_per_flight: number;
  cost_per_flight: number;
  cost_breakdown: TripCostBreakdown;
  profit_per_flight: number;
  profit_per_hour: number;
  profit_per_week: number;
  scheduling: SchedulingInfo;
};

export type OptimizedRouteResult = {
  fleet_mix: FleetMixRow[];
  total_profit_per_week: number;
  demand_fulfilled_optimized: number;
  marginal_a330_value: number;
  marginal_a380_value: number;
  marginal_values: { aircraft: string; value: number }[];
  scheduling_summary: SchedulingInfo;
};

export type ComparisonResult = {
  current_profit_per_week: number;
  optimized_profit_per_week: number;
  delta_per_week: number;
  delta_per_aircraft_per_week: number;
  current_demand_fulfilled: number;
  optimized_demand_fulfilled: number;
};

function toRow(ac: Aircraft, fe: FlightEconomics): FleetMixRow {
  const cb = fe.cost_breakdown;
  return {
    type: ac.shortCode,
    name: ac.name,
    config: fe.config,
    trips_per_week: fe.trips_per_week,
    flight_time_hours: fe.scheduling.flight_time_hours,
    revenue_per_flight: fe.revenue_per_flight,
    cost_per_flight: cb.total,
    cost_breakdown: {
      fuel: cb.fuel,
      co2: cb.co2,
      acheck: cb.acheck,
      repair: cb.repair,
      total: cb.total,
    },
    profit_per_flight: fe.profit_per_flight,
    profit_per_hour:
      fe.scheduling.flight_time_hours > 0 ? fe.profit_per_flight / fe.scheduling.flight_time_hours : 0,
    profit_per_week: fe.profit_per_week,
    scheduling: fe.scheduling,
  };
}

function soloWeeklyProfit(
  ac: Aircraft,
  company: Company,
  distance: number,
  demand: Demand
): number {
  return evaluateAircraftOnRoute(ac, company, distance, demand)?.profit_per_week ?? -Infinity;
}

/** Partition route demand into `k` disjoint buckets with identical totals per class (largest-remainder split). */
function splitDemandEqually(demand: Demand, k: number): Demand[] {
  if (k < 1) return [];
  const part = (n: number): number[] => {
    const base = Math.floor(n / k);
    const rem = n % k;
    return Array.from({ length: k }, (_, i) => base + (i < rem ? 1 : 0));
  };
  const ys = part(demand.y);
  const js = part(demand.j);
  const fs = part(demand.f);
  return Array.from({ length: k }, (_, i) => ({ y: ys[i]!, j: js[i]!, f: fs[i]! }));
}

export function orderAircraftForCombo(
  n380: number,
  n330: number,
  company: Company,
  distance: number,
  fullDemand: Demand
) {
  const list = [
    ...Array.from({ length: n380 }, () => A380_SPEC),
    ...Array.from({ length: n330 }, () => A330_SPEC),
  ];
  const s380 = soloWeeklyProfit(A380_SPEC, company, distance, fullDemand);
  const s330 = soloWeeklyProfit(A330_SPEC, company, distance, fullDemand);
  if (s380 >= s330) {
    return [
      ...list.filter((a) => a.shortCode === "A380"),
      ...list.filter((a) => a.shortCode === "A330"),
    ] as Aircraft[];
  }
  return [
    ...list.filter((a) => a.shortCode === "A330"),
    ...list.filter((a) => a.shortCode === "A380"),
  ] as Aircraft[];
}

function evaluateComboCounts(
  n380: number,
  n330: number,
  company: Company,
  distance: number,
  demand: Demand,
  maxPlanes = MAX_AIRCRAFT_PER_ROUTE
): { plan: FleetMixRow[]; total_profit_per_week: number; fulfilled: number } | null {
  const totalPlanes = n380 + n330;
  if (totalPlanes < 1 || totalPlanes > maxPlanes) return null;

  const ordered = orderAircraftForCombo(n380, n330, company, distance, demand);
  let remaining: Demand = { ...demand };
  const planRows: { ac: Aircraft; fe: FlightEconomics }[] = [];

  for (const ac of ordered) {
    const fe = evaluateAircraftOnRoute(ac, company, distance, remaining);
    if (!fe || fe.profit_per_flight <= 0) {
      return null;
    }
    planRows.push({ ac, fe });
    remaining = {
      y: Math.max(0, remaining.y - fe.config.y),
      j: Math.max(0, remaining.j - fe.config.j),
      f: Math.max(0, remaining.f - fe.config.f),
    };
  }

  const total = planRows.reduce((s, p) => s + p.fe.profit_per_week, 0);
  const served = planRows.reduce(
    (acc, p) => ({
      y: acc.y + p.fe.config.y,
      j: acc.j + p.fe.config.j,
      f: acc.f + p.fe.config.f,
    }),
    { y: 0, j: 0, f: 0 }
  );
  const fulfilled = demandFulfilledPercent(demand, served);

  return {
    plan: planRows.map((p) => toRow(p.ac, p.fe)),
    total_profit_per_week: total,
    fulfilled,
  };
}

/**
 * Same fleet counts as sequential allocation, but each aircraft optimizes against an ~equal share of route demand.
 * Produces more uniform cabins across parallel hulls; weekly profit may differ from sequential greedy.
 */
function evaluateComboCountsEqualSplit(
  n380: number,
  n330: number,
  company: Company,
  distance: number,
  demand: Demand,
  maxPlanes = MAX_AIRCRAFT_PER_ROUTE
): { plan: FleetMixRow[]; total_profit_per_week: number; fulfilled: number } | null {
  const totalPlanes = n380 + n330;
  if (totalPlanes < 1 || totalPlanes > maxPlanes) return null;

  const ordered = orderAircraftForCombo(n380, n330, company, distance, demand);
  const chunks = splitDemandEqually(demand, ordered.length);
  const planRows: { ac: Aircraft; fe: FlightEconomics }[] = [];

  for (let i = 0; i < ordered.length; i++) {
    const fe = evaluateAircraftOnRoute(ordered[i]!, company, distance, chunks[i]!);
    if (!fe || fe.profit_per_flight <= 0) return null;
    planRows.push({ ac: ordered[i]!, fe });
  }

  const total = planRows.reduce((s, p) => s + p.fe.profit_per_week, 0);
  const served = planRows.reduce(
    (acc, p) => ({
      y: acc.y + p.fe.config.y,
      j: acc.j + p.fe.config.j,
      f: acc.f + p.fe.config.f,
    }),
    { y: 0, j: 0, f: 0 }
  );
  const fulfilled = demandFulfilledPercent(demand, served);

  return {
    plan: planRows.map((p) => toRow(p.ac, p.fe)),
    total_profit_per_week: total,
    fulfilled,
  };
}

/** Marginal: +1 frame vs optimized baseline using equal-split economics (matches fleet_mix semantics). */
function evaluateOneExtraPlaneEqualSplit(
  n380: number,
  n330: number,
  extra: "A380" | "A330",
  company: Company,
  distance: number,
  demand: Demand,
  baselineWeeklyProfit: number
): number {
  const n380e = n380 + (extra === "A380" ? 1 : 0);
  const n330e = n330 + (extra === "A330" ? 1 : 0);
  if (n380e + n330e > MAX_AIRCRAFT_MARGINAL_PROBE) return baselineWeeklyProfit;
  const result = evaluateComboCountsEqualSplit(
    n380e,
    n330e,
    company,
    distance,
    demand,
    MAX_AIRCRAFT_MARGINAL_PROBE
  );
  return result?.total_profit_per_week ?? baselineWeeklyProfit;
}

function schedulingFromPlan(plan: FleetMixRow[]): SchedulingInfo {
  if (!plan.length) {
    return {
      flight_time_hours: 0,
      trips_per_week: 0,
      trip_bracket: 1,
      threshold_proximity_minutes: 0,
    };
  }
  const minTrips = Math.min(...plan.map((p) => p.trips_per_week));
  const worst = plan.find((p) => p.trips_per_week === minTrips) ?? plan[0]!;
  return worst.scheduling;
}

/**
 * Backbone §10 — enumerate (n380,n330), 1..MAX_AIRCRAFT_PER_ROUTE aircraft, pick max weekly profit.
 */
export function optimizeRoute(
  distance: number,
  demand: Demand,
  company: Company
): OptimizedRouteResult {
  let best: { n380: number; n330: number; plan: FleetMixRow[]; total: number; fulfilled: number } | null =
    null;

  for (let n380 = 0; n380 <= MAX_AIRCRAFT_PER_ROUTE; n380++) {
    for (let n330 = 0; n330 <= MAX_AIRCRAFT_PER_ROUTE; n330++) {
      if (n380 + n330 < 1 || n380 + n330 > MAX_AIRCRAFT_PER_ROUTE) continue;
      const r = evaluateComboCounts(n380, n330, company, distance, demand);
      if (!r) continue;
      if (!best || r.total_profit_per_week > best.total) {
        best = { n380, n330, plan: r.plan, total: r.total_profit_per_week, fulfilled: r.fulfilled };
      }
    }
  }

  if (!best) {
    return {
      fleet_mix: [],
      total_profit_per_week: 0,
      demand_fulfilled_optimized: 0,
      marginal_a330_value: 0,
      marginal_a380_value: 0,
      marginal_values: [
        { aircraft: "A330", value: 0 },
        { aircraft: "A380", value: 0 },
      ],
      scheduling_summary: schedulingFromPlan([]),
    };
  }

  const normalized = evaluateComboCountsEqualSplit(best.n380, best.n330, company, distance, demand);
  const outputPlan = normalized ?? best;
  const outputTotal = normalized?.total_profit_per_week ?? best.total;
  const outputFulfilled = normalized?.fulfilled ?? best.fulfilled;

  const withExtra330 = evaluateOneExtraPlaneEqualSplit(
    best.n380,
    best.n330,
    "A330",
    company,
    distance,
    demand,
    outputTotal
  );
  const withExtra380 = evaluateOneExtraPlaneEqualSplit(
    best.n380,
    best.n330,
    "A380",
    company,
    distance,
    demand,
    outputTotal
  );
  const marg330 = withExtra330 - outputTotal;
  const marg380 = withExtra380 - outputTotal;

  return {
    fleet_mix: outputPlan.plan,
    total_profit_per_week: outputTotal,
    demand_fulfilled_optimized: outputFulfilled,
    marginal_a330_value: marg330,
    marginal_a380_value: marg380,
    marginal_values: [
      { aircraft: "A330", value: marg330 },
      { aircraft: "A380", value: marg380 },
    ],
    scheduling_summary: schedulingFromPlan(outputPlan.plan),
  };
}

/** Current deployment: fixed configs in order given (DB position). */
export function evaluateCurrentAssignment(
  distance: number,
  demand: Demand,
  rows: CurrentAircraftRow[],
  company: Company
): { total_profit_per_week: number; fulfilled: number; plan: FleetMixRow[] } {
  let remaining: Demand = { ...demand };
  const plan: FleetMixRow[] = [];
  let total = 0;

  for (const row of rows) {
    const ac = row.type === "A380" ? A380_SPEC : A330_SPEC;
    const fe = evaluateWithFixedConfig(ac, company, distance, row.config);
    if (!fe) continue;
    total += fe.profit_per_week;
    plan.push(toRow(ac, fe));
    remaining = {
      y: Math.max(0, remaining.y - fe.config.y),
      j: Math.max(0, remaining.j - fe.config.j),
      f: Math.max(0, remaining.f - fe.config.f),
    };
  }

  const served = plan.reduce(
    (acc, p) => ({
      y: acc.y + p.config.y,
      j: acc.j + p.config.j,
      f: acc.f + p.config.f,
    }),
    { y: 0, j: 0, f: 0 }
  );
  const fulfilled = demandFulfilledPercent(demand, served);

  return { total_profit_per_week: total, fulfilled, plan };
}

export function buildComparison(
  currentProfit: number,
  currentFulfilled: number,
  opt: OptimizedRouteResult
): ComparisonResult {
  const n = Math.max(1, opt.fleet_mix.length);
  return {
    current_profit_per_week: currentProfit,
    optimized_profit_per_week: opt.total_profit_per_week,
    delta_per_week: opt.total_profit_per_week - currentProfit,
    delta_per_aircraft_per_week: (opt.total_profit_per_week - currentProfit) / n,
    current_demand_fulfilled: currentFulfilled,
    optimized_demand_fulfilled: opt.demand_fulfilled_optimized,
  };
}

