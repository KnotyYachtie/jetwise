import { sql } from "@vercel/postgres";

export type AirportCoord = { lat: number; lng: number };

/**
 * Batch-resolve lat/lon from `airport_lookup`. Missing table or rows → omitted from map.
 */
export async function resolveAirportCoordinatesBatch(
  icaos: string[]
): Promise<Map<string, AirportCoord>> {
  const out = new Map<string, AirportCoord>();
  const unique = [...new Set(icaos.map((c) => c.trim().toUpperCase()).filter(Boolean))];
  if (unique.length === 0) return out;

  try {
    const rows = await Promise.all(
      unique.map(async (icao) => {
        try {
          const r = await sql`
            SELECT icao, lat, lon FROM airport_lookup WHERE icao = ${icao} LIMIT 1
          `;
          return r.rows[0] as { icao?: string; lat?: unknown; lon?: unknown } | undefined;
        } catch {
          return undefined;
        }
      })
    );
    for (const row of rows) {
      if (!row) continue;
      const icao = (row.icao ?? "").toUpperCase();
      const lat = row.lat != null ? Number(row.lat) : NaN;
      const lon = row.lon != null ? Number(row.lon) : NaN;
      if (!icao || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      out.set(icao, { lat, lng: lon });
    }
  } catch {
    /* table missing or query error — map omits segments */
  }
  return out;
}
