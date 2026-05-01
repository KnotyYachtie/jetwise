import { sql } from "@vercel/postgres";
import { resolveAirportCoordinatesBatch, type AirportCoord } from "./airport-coordinates";

export type RouteMapDot = {
  start: { lat: number; lng: number; label?: string };
  end: { lat: number; lng: number; label?: string };
};

type RouteRow = { origin: string; destination: string; technical_stop: string | null };

function validCoord(c: AirportCoord | undefined): c is AirportCoord {
  return c != null && Number.isFinite(c.lat) && Number.isFinite(c.lng);
}

function segment(
  fromIcao: string,
  toIcao: string,
  coordByIcao: Map<string, AirportCoord>
): RouteMapDot | null {
  const a = fromIcao.trim().toUpperCase();
  const b = toIcao.trim().toUpperCase();
  if (!a || !b) return null;
  const start = coordByIcao.get(a);
  const end = coordByIcao.get(b);
  if (!validCoord(start) || !validCoord(end)) return null;
  return {
    start: { lat: start.lat, lng: start.lng, label: a },
    end: { lat: end.lat, lng: end.lng, label: b },
  };
}

/**
 * Builds globe arc segments from stored routes (not optimizer output).
 * One segment per leg: origin→stop and stop→destination when `technical_stop` is set.
 */
export async function getRouteMapDots(): Promise<RouteMapDot[]> {
  try {
    const routesRes = await sql`
      SELECT origin, destination, technical_stop FROM routes
    `;
    const rows = routesRes.rows as RouteRow[];
    const needed = new Set<string>();
    for (const r of rows) {
      const o = (r.origin ?? "").trim().toUpperCase();
      const d = (r.destination ?? "").trim().toUpperCase();
      const t = (r.technical_stop ?? "").trim().toUpperCase() || null;
      if (!o || !d) continue;
      needed.add(o);
      needed.add(d);
      if (t) needed.add(t);
    }
    const coordByIcao = await resolveAirportCoordinatesBatch([...needed]);
    const dots: RouteMapDot[] = [];
    for (const r of rows) {
      const o = (r.origin ?? "").trim().toUpperCase();
      const d = (r.destination ?? "").trim().toUpperCase();
      const t = (r.technical_stop ?? "").trim().toUpperCase() || null;
      if (!o || !d) continue;
      if (t) {
        const s1 = segment(o, t, coordByIcao);
        const s2 = segment(t, d, coordByIcao);
        if (s1) dots.push(s1);
        if (s2) dots.push(s2);
      } else {
        const s = segment(o, d, coordByIcao);
        if (s) dots.push(s);
      }
    }
    return dots;
  } catch {
    return [];
  }
}
