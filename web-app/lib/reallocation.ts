import type { Company } from "./economics";
import { evaluateCurrentAssignment } from "./optimizer";
import type { CurrentAircraftRow, Demand } from "./types";

export type RouteForRealloc = {
  id: string;
  origin: string;
  destination: string;
  distance: number;
  demand: Demand;
  current: { aircraft: CurrentAircraftRow[] };
  optimized: { marginal_a330_value: number; marginal_a380_value: number };
};

export type ReallocSuggestion = {
  from_route: string;
  to_route: string;
  from_label: string;
  to_label: string;
  aircraft_type: "A380" | "A330";
  current_contribution: number;
  potential_gain: number;
  net_fleet_gain: number;
  confidence: "high" | "medium" | "low";
};

function confidenceFor(gain: number, base: number): "high" | "medium" | "low" {
  if (base <= 0) return gain > 0 ? "high" : "low";
  const r = gain / base;
  if (r > 0.2) return "high";
  if (r > 0.05) return "medium";
  return "low";
}

function perAircraftContribution(
  distance: number,
  demand: Demand,
  rows: CurrentAircraftRow[],
  company: Company
): { index: number; contribution: number; type: "A380" | "A330" }[] {
  const full = evaluateCurrentAssignment(distance, demand, rows, company);
  return rows.map((_, i) => {
    const sub = rows.filter((_, j) => j !== i);
    const w = evaluateCurrentAssignment(distance, demand, sub, company);
    return {
      index: i,
      contribution: full.total_profit_per_week - w.total_profit_per_week,
      type: rows[i]!.type,
    };
  });
}

/**
 * Backbone §12 — secondary (2+ aircraft) vs marginal destination opportunity.
 */
export function suggestReallocations(
  routes: RouteForRealloc[],
  company: Company
): ReallocSuggestion[] {
  const out: ReallocSuggestion[] = [];

  for (const from of routes) {
    const rows = from.current?.aircraft ?? [];
    if (rows.length < 2) continue;

    const contribs = perAircraftContribution(
      from.distance,
      from.demand,
      rows,
      company
    );
    const sec = contribs.reduce((a, b) => (a.contribution < b.contribution ? a : b));

    for (const to of routes) {
      if (to.id === from.id) continue;
      const m = to.optimized;
      const pot =
        sec.type === "A380" ? m.marginal_a380_value : m.marginal_a330_value;
      if (pot <= sec.contribution) continue;
      const net = pot - sec.contribution;
      out.push({
        from_route: from.id,
        to_route: to.id,
        from_label: `${from.origin} → ${from.destination}`,
        to_label: `${to.origin} → ${to.destination}`,
        aircraft_type: sec.type,
        current_contribution: sec.contribution,
        potential_gain: pot,
        net_fleet_gain: net,
        confidence: confidenceFor(net, Math.abs(sec.contribution)),
      });
    }
  }

  out.sort((a, b) => b.net_fleet_gain - a.net_fleet_gain);
  return out;
}

