import { A350_SPEC, A380_SPEC, A330_SPEC, type AircraftCode } from "./aircraft-data";
import type { Aircraft, Company, FlightEconomics, SchedulingInfo } from "./economics";
import {
  dailyThroughputFromSchedule,
  demandFulfilledPercent,
  evaluateAircraftOnRoute,
  evaluateWithFixedConfig,
} from "./economics";
import type { CurrentAircraftRow, Demand } from "./types";

/** Maximum aircraft deployed per route in optimizer enumeration (n380 + n330 ≤ this). */
export const MAX_AIRCRAFT_PER_ROUTE = 8;
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
  marginal_a350_value: number;
  marginal_values: { aircraft: string; value: number }[];
  scheduling_summary: SchedulingInfo;
};

export type OptimizerOptions = {
  allow_a380?: boolean;
  allow_a330?: boolean;
  allow_a350?: boolean;
  hull_penalty_per_aircraft?: number;
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
  counts: Record<AircraftCode, number>,
  activeFleet: Aircraft[],
  company: Company,
  distance: number,
  fullDemand: Demand
) {
  const list: Aircraft[] = [];
  for (const ac of activeFleet) {
    const n = counts[ac.shortCode as AircraftCode] ?? 0;
    for (let i = 0; i < n; i++) list.push(ac);
  }
  const score = new Map(
    activeFleet.map((ac) => [ac.shortCode, soloWeeklyProfit(ac, company, distance, fullDemand)])
  );
  return list.sort((a, b) => (score.get(b.shortCode) ?? -Infinity) - (score.get(a.shortCode) ?? -Infinity));
}

function evaluateComboCounts(
  counts: Record<AircraftCode, number>,
  activeFleet: Aircraft[],
  company: Company,
  distance: number,
  demand: Demand,
  maxPlanes = MAX_AIRCRAFT_PER_ROUTE
): { plan: FleetMixRow[]; total_profit_per_week: number; fulfilled: number } | null {
  const totalPlanes = Object.values(counts).reduce((s, n) => s + n, 0);
  if (totalPlanes < 1 || totalPlanes > maxPlanes) return null;

  const ordered = orderAircraftForCombo(counts, activeFleet, company, distance, demand);
  let remaining: Demand = { ...demand };
  const planRows: { ac: Aircraft; fe: FlightEconomics }[] = [];

  for (const ac of ordered) {
    const fe = evaluateAircraftOnRoute(ac, company, distance, remaining);
    if (!fe || fe.profit_per_flight <= 0) {
      return null;
    }
    planRows.push({ ac, fe });
    const dt = dailyThroughputFromSchedule(fe.config, fe.trips_per_week);
    remaining = {
      y: Math.max(0, remaining.y - dt.y),
      j: Math.max(0, remaining.j - dt.j),
      f: Math.max(0, remaining.f - dt.f),
    };
  }

  const total = planRows.reduce((s, p) => s + p.fe.profit_per_week, 0);
  const served = planRows.reduce((acc, p) => {
    const d = dailyThroughputFromSchedule(p.fe.config, p.fe.trips_per_week);
    return { y: acc.y + d.y, j: acc.j + d.j, f: acc.f + d.f };
  }, { y: 0, j: 0, f: 0 });
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
  counts: Record<AircraftCode, number>,
  activeFleet: Aircraft[],
  company: Company,
  distance: number,
  demand: Demand,
  maxPlanes = MAX_AIRCRAFT_PER_ROUTE
): { plan: FleetMixRow[]; total_profit_per_week: number; fulfilled: number } | null {
  const totalPlanes = Object.values(counts).reduce((s, n) => s + n, 0);
  if (totalPlanes < 1 || totalPlanes > maxPlanes) return null;

  const ordered = orderAircraftForCombo(counts, activeFleet, company, distance, demand);
  const chunks = splitDemandEqually(demand, ordered.length);
  const planRows: { ac: Aircraft; fe: FlightEconomics }[] = [];

  for (let i = 0; i < ordered.length; i++) {
    const fe = evaluateAircraftOnRoute(ordered[i]!, company, distance, chunks[i]!);
    if (!fe || fe.profit_per_flight <= 0) return null;
    planRows.push({ ac: ordered[i]!, fe });
  }

  const total = planRows.reduce((s, p) => s + p.fe.profit_per_week, 0);
  const served = planRows.reduce((acc, p) => {
    const d = dailyThroughputFromSchedule(p.fe.config, p.fe.trips_per_week);
    return { y: acc.y + d.y, j: acc.j + d.j, f: acc.f + d.f };
  }, { y: 0, j: 0, f: 0 });
  const fulfilled = demandFulfilledPercent(demand, served);

  return {
    plan: planRows.map((p) => toRow(p.ac, p.fe)),
    total_profit_per_week: total,
    fulfilled,
  };
}

/** Marginal: +1 frame vs optimized baseline using equal-split economics (matches fleet_mix semantics). */
function evaluateOneExtraPlaneEqualSplit(
  counts: Record<AircraftCode, number>,
  activeFleet: Aircraft[],
  extra: AircraftCode,
  company: Company,
  distance: number,
  demand: Demand,
  baselineWeeklyProfit: number
): number {
  const next = { ...counts, [extra]: (counts[extra] ?? 0) + 1 };
  if (Object.values(next).reduce((s, n) => s + n, 0) > MAX_AIRCRAFT_MARGINAL_PROBE) return baselineWeeklyProfit;
  const result = evaluateComboCountsEqualSplit(
    next,
    activeFleet,
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
  company: Company,
  options: OptimizerOptions = {}
): OptimizedRouteResult {
  const allowA380 = options.allow_a380 ?? true;
  const allowA330 = options.allow_a330 ?? true;
  const allowA350 = options.allow_a350 ?? true;
  const hullPenalty = Number.isFinite(options.hull_penalty_per_aircraft)
    ? Math.max(0, options.hull_penalty_per_aircraft ?? 0)
    : 0;

  const activeFleet: Aircraft[] = [
    ...(allowA380 ? [A380_SPEC] : []),
    ...(allowA330 ? [A330_SPEC] : []),
    ...(allowA350 ? [A350_SPEC] : []),
  ];

  type Counts = Record<AircraftCode, number>;
  type BestChoice = {
    counts: Counts;
    plan: FleetMixRow[];
    total: number;
    fulfilled: number;
    adjustedTotal: number;
  };
  let best: BestChoice | null = null;

  const codes = activeFleet.map((ac) => ac.shortCode as AircraftCode);
  const seed: Counts = { A380: 0, A330: 0, A350: 0 };

  function enumerate(idx: number, counts: Counts, totalPlanes: number) {
    if (idx === codes.length) {
      if (totalPlanes < 1 || totalPlanes > MAX_AIRCRAFT_PER_ROUTE) return;
      const r = evaluateComboCounts(counts, activeFleet, company, distance, demand);
      if (!r) return;
      const adjusted = r.total_profit_per_week - hullPenalty * totalPlanes;
      if (!best || adjusted > best.adjustedTotal) {
        best = {
          counts: { ...counts },
          plan: r.plan,
          total: r.total_profit_per_week,
          fulfilled: r.fulfilled,
          adjustedTotal: adjusted,
        };
      }
      return;
    }

    const code = codes[idx]!;
    for (let n = 0; n <= MAX_AIRCRAFT_PER_ROUTE - totalPlanes; n++) {
      counts[code] = n;
      enumerate(idx + 1, counts, totalPlanes + n);
    }
    counts[code] = 0;
  }

  enumerate(0, { ...seed }, 0);

  if (!best) {
    return {
      fleet_mix: [],
      total_profit_per_week: 0,
      demand_fulfilled_optimized: 0,
      marginal_a330_value: 0,
      marginal_a380_value: 0,
      marginal_a350_value: 0,
      marginal_values: [
        { aircraft: "A330", value: 0 },
        { aircraft: "A380", value: 0 },
        { aircraft: "A350", value: 0 },
      ],
      scheduling_summary: schedulingFromPlan([]),
    };
  }
  const chosen = best as BestChoice;

  const normalized = evaluateComboCountsEqualSplit(chosen.counts, activeFleet, company, distance, demand);
  const outputPlan = normalized ?? chosen;
  const outputTotal = normalized?.total_profit_per_week ?? chosen.total;
  const outputFulfilled = normalized?.fulfilled ?? chosen.fulfilled;
  const withExtra = (code: AircraftCode) =>
    activeFleet.some((a) => a.shortCode === code)
      ? evaluateOneExtraPlaneEqualSplit(chosen.counts, activeFleet, code, company, distance, demand, outputTotal)
      : outputTotal;
  const marg330 = withExtra("A330") - outputTotal;
  const marg380 = withExtra("A380") - outputTotal;
  const marg350 = withExtra("A350") - outputTotal;

  return {
    fleet_mix: outputPlan.plan,
    total_profit_per_week: outputTotal,
    demand_fulfilled_optimized: outputFulfilled,
    marginal_a330_value: marg330,
    marginal_a380_value: marg380,
    marginal_a350_value: marg350,
    marginal_values: [
      { aircraft: "A330", value: marg330 },
      { aircraft: "A380", value: marg380 },
      { aircraft: "A350", value: marg350 },
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
    const ac = row.type === "A380" ? A380_SPEC : row.type === "A350" ? A350_SPEC : A330_SPEC;
    const fe = evaluateWithFixedConfig(ac, company, distance, row.config);
    if (!fe) continue;
    total += fe.profit_per_week;
    plan.push(toRow(ac, fe));
    const dt = dailyThroughputFromSchedule(fe.config, fe.trips_per_week);
    remaining = {
      y: Math.max(0, remaining.y - dt.y),
      j: Math.max(0, remaining.j - dt.j),
      f: Math.max(0, remaining.f - dt.f),
    };
  }

  const served = plan.reduce((acc, p) => {
    const d = dailyThroughputFromSchedule(p.config, p.trips_per_week);
    return { y: acc.y + d.y, j: acc.j + d.j, f: acc.f + d.f };
  }, { y: 0, j: 0, f: 0 });
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

