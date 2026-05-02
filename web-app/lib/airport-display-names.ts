import { sql } from "@vercel/postgres";
import { HUBS } from "./hubs";

const hubNameByIcao = new Map(HUBS.map((h) => [h.icao.toUpperCase(), h.name]));
const hubMetaByIcao = new Map(
  HUBS.map((h) => [
    h.icao.toUpperCase(),
    {
      icao: h.icao.toUpperCase(),
      name: h.name,
      city: h.city,
      countryIso2: h.country,
    },
  ])
);

export type AirportDisplayMeta = {
  icao: string;
  name: string | null;
  city: string | null;
  countryIso2: string | null;
};

export async function resolveAirportMetaBatch(
  pairs: { origin: string; destination: string }[]
): Promise<Map<string, AirportDisplayMeta>> {
  const needed = new Set<string>();
  for (const p of pairs) {
    needed.add(p.origin.toUpperCase());
    needed.add(p.destination.toUpperCase());
  }
  const out = new Map<string, AirportDisplayMeta>();
  const needLookup: string[] = [];
  for (const icao of needed) {
    const hub = hubMetaByIcao.get(icao);
    if (hub) out.set(icao, hub);
    else needLookup.push(icao);
  }
  if (needLookup.length === 0) return out;

  const rows = await Promise.all(
    needLookup.map(async (icao) => {
      try {
        const r = await sql`
          SELECT name, city, country
          FROM airport_lookup
          WHERE icao = ${icao}
          LIMIT 1
        `;
        const row = r.rows[0] as { name?: string | null; city?: string | null; country?: string | null } | undefined;
        return {
          icao,
          name: row?.name ?? null,
          city: row?.city ?? null,
          countryIso2: row?.country ?? null,
        };
      } catch {
        return { icao, name: null, city: null, countryIso2: null };
      }
    })
  );

  for (const row of rows) {
    if (row.name || row.city || row.countryIso2) {
      out.set(row.icao, row);
    }
  }
  return out;
}

/**
 * Resolve display names for ICAO codes: company hubs first, then `airport_lookup`.
 */
export async function resolveAirportDisplayNamesBatch(
  pairs: { origin: string; destination: string }[]
): Promise<Map<string, string>> {
  const meta = await resolveAirportMetaBatch(pairs);
  const out = new Map<string, string>();
  for (const [icao, info] of meta) {
    if (info.name) {
      out.set(icao, info.name);
      continue;
    }
    const hubName = hubNameByIcao.get(icao);
    if (hubName) out.set(icao, hubName);
  }
  return out;
}
