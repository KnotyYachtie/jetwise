import type { Company } from "./economics";
import {
  buildComparison,
  evaluateCurrentAssignment,
  optimizeRoute,
  type OptimizedRouteResult,
} from "./optimizer";
import type { CurrentAircraftRow, Demand } from "./types";
import type { SchedulingInfo } from "./economics";

export type DbRoute = {
  id: string;
  origin: string;
  destination: string;
  distance: number;
  hub: string | null;
  demand_y: number;
  demand_j: number;
  demand_f: number;
  technical_stop: string | null;
  status: string;
  notes: string | null;
  created_at?: Date | string;
  updated_at?: Date | string;
};

export type AssignmentRow = {
  aircraft_type: string;
  config_y: number;
  config_j: number;
  config_f: number;
  position: number;
};

export type OptimizedApi = Omit<OptimizedRouteResult, "scheduling_summary"> & {
  scheduling: SchedulingInfo;
};

export type RoutePayload = DbRoute & {
  demand: Demand;
  current: {
    aircraft: CurrentAircraftRow[];
    notes: string | null;
    weekly_profit_per_week?: number;
    demand_fulfilled_pct?: number;
  };
  optimized: OptimizedApi;
  comparison: ReturnType<typeof buildComparison>;
};

function toOptimizedApi(opt: OptimizedRouteResult): OptimizedApi {
  const { scheduling_summary, ...rest } = opt;
  return { ...rest, scheduling: scheduling_summary };
}

export function enrichRoute(
  route: DbRoute,
  assignments: AssignmentRow[],
  company: Company
): RoutePayload {
  const demand: Demand = {
    y: route.demand_y,
    j: route.demand_j,
    f: route.demand_f,
  };

  const aircraft: CurrentAircraftRow[] = assignments
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((a) => ({
      type: (a.aircraft_type === "A330" ? "A330" : "A380") as "A380" | "A330",
      config: {
        y: a.config_y,
        j: a.config_j,
        f: a.config_f,
      },
    }));

  const cur = evaluateCurrentAssignment(route.distance, demand, aircraft, company);
  const opt = optimizeRoute(route.distance, demand, company);
  const comparison = buildComparison(
    cur.total_profit_per_week,
    cur.fulfilled,
    opt
  );

  return {
    ...route,
    demand,
    current: {
      aircraft,
      notes: route.notes,
      weekly_profit_per_week: cur.total_profit_per_week,
      demand_fulfilled_pct: cur.fulfilled,
    },
    optimized: toOptimizedApi(opt),
    comparison,
  };
}
