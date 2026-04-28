import { sql } from "@vercel/postgres";
import { resolveAirportDisplayNamesBatch } from "./airport-display-names";
import { getCompany } from "./company";
import {
  enrichRoute,
  type AssignmentRow,
  type DbRoute,
  type RoutePayload,
} from "./route-payload";

export async function getEnrichedRoutes(): Promise<RoutePayload[]> {
  const company = await getCompany();
  const routesRes = await sql`SELECT * FROM routes ORDER BY updated_at DESC NULLS LAST, id DESC`;
  const aRes = await sql`SELECT * FROM route_assignments`;
  const enriched = routesRes.rows.map((r) => {
    const asg = aRes.rows.filter((a) => (a as { route_id?: string }).route_id === r.id) as AssignmentRow[];
    return enrichRoute(r as DbRoute, asg, company);
  });
  const nameMap = await resolveAirportDisplayNamesBatch(
    enriched.map((r) => ({ origin: r.origin, destination: r.destination }))
  );
  return enriched.map((r) => ({
    ...r,
    origin_airport_name: nameMap.get(r.origin.toUpperCase()) ?? null,
    destination_airport_name: nameMap.get(r.destination.toUpperCase()) ?? null,
  }));
}

export async function getEnrichedRouteById(id: string): Promise<RoutePayload | null> {
  const company = await getCompany();
  const r = await sql`SELECT * FROM routes WHERE id = ${id}`;
  if (r.rows.length === 0) return null;
  const a = await sql`SELECT * FROM route_assignments WHERE route_id = ${id} ORDER BY position ASC`;
  const base = enrichRoute(r.rows[0] as DbRoute, a.rows as AssignmentRow[], company);
  const nameMap = await resolveAirportDisplayNamesBatch([
    { origin: base.origin, destination: base.destination },
  ]);
  return {
    ...base,
    origin_airport_name: nameMap.get(base.origin.toUpperCase()) ?? null,
    destination_airport_name: nameMap.get(base.destination.toUpperCase()) ?? null,
  };
}
