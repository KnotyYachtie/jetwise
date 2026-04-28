import { sql } from "@vercel/postgres";
import { HUBS } from "./hubs";

const hubNameByIcao = new Map(HUBS.map((h) => [h.icao.toUpperCase(), h.name]));

/**
 * Resolve display names for ICAO codes: company hubs first, then `airport_lookup`.
 */
export async function resolveAirportDisplayNamesBatch(
  pairs: { origin: string; destination: string }[]
): Promise<Map<string, string>> {
  const needed = new Set<string>();
  for (const p of pairs) {
    needed.add(p.origin.toUpperCase());
    needed.add(p.destination.toUpperCase());
  }
  const out = new Map<string, string>();
  const needLookup: string[] = [];
  for (const icao of needed) {
    const hub = hubNameByIcao.get(icao);
    if (hub) out.set(icao, hub);
    else needLookup.push(icao);
  }
  if (needLookup.length === 0) return out;

  const rows = await Promise.all(
    needLookup.map(async (icao) => {
      try {
        const r = await sql`SELECT name FROM airport_lookup WHERE icao = ${icao} LIMIT 1`;
        const row = r.rows[0] as { name?: string } | undefined;
        return { icao, name: row?.name ?? null };
      } catch {
        return { icao, name: null };
      }
    })
  );
  for (const { icao, name } of rows) {
    if (name) out.set(icao, name);
  }
  return out;
}
