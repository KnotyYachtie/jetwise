import type { OptimizerOptions } from "./optimizer";

function parseBool(v: string | null): boolean | undefined {
  if (v == null) return undefined;
  const s = v.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(s)) return true;
  if (["0", "false", "no", "off"].includes(s)) return false;
  return undefined;
}

export function optionsFromSearchParams(params: URLSearchParams): OptimizerOptions {
  const allow_a380 = parseBool(params.get("allowA380"));
  const allow_a330 = parseBool(params.get("allowA330"));
  const allow_a350 = parseBool(params.get("allowA350"));
  const hullRaw = params.get("hullPenalty");
  const hull_penalty_per_aircraft =
    hullRaw == null || hullRaw === "" ? undefined : Number.isFinite(Number(hullRaw)) ? Number(hullRaw) : undefined;
  return { allow_a380, allow_a330, allow_a350, hull_penalty_per_aircraft };
}

export function optionsToQuery(options: OptimizerOptions): string {
  const p = new URLSearchParams();
  if (options.allow_a380 !== undefined) p.set("allowA380", options.allow_a380 ? "1" : "0");
  if (options.allow_a330 !== undefined) p.set("allowA330", options.allow_a330 ? "1" : "0");
  if (options.allow_a350 !== undefined) p.set("allowA350", options.allow_a350 ? "1" : "0");
  if (
    options.hull_penalty_per_aircraft !== undefined &&
    Number.isFinite(options.hull_penalty_per_aircraft)
  ) {
    p.set("hullPenalty", String(Math.max(0, options.hull_penalty_per_aircraft)));
  }
  return p.toString();
}
