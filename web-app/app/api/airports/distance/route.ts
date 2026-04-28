import { sql } from "@vercel/postgres";
import { type NextRequest, NextResponse } from "next/server";
import { haversineKm } from "@/lib/haversine";

/** GET ?origin=KMIA&destination=KLGA → great-circle distance (km) when coords exist */
export async function GET(request: NextRequest) {
  const origin = (request.nextUrl.searchParams.get("origin") ?? "").trim().toUpperCase();
  const destination = (request.nextUrl.searchParams.get("destination") ?? "").trim().toUpperCase();

  if (!origin || !destination) {
    return NextResponse.json({ error: "Missing origin or destination" }, { status: 400 });
  }

  try {
    const rows = await sql`
      SELECT icao, lat, lon FROM airport_lookup
      WHERE UPPER(icao) = ${origin} OR UPPER(icao) = ${destination}
    `;
    const map = new Map<
      string,
      { lat: number; lon: number }
    >();
    for (const r of rows.rows as { icao: string; lat: number | null; lon: number | null }[]) {
      const code = r.icao.toUpperCase();
      if (r.lat != null && r.lon != null && Number.isFinite(r.lat) && Number.isFinite(r.lon)) {
        map.set(code, { lat: r.lat, lon: r.lon });
      }
    }

    const a = map.get(origin);
    const b = map.get(destination);
    if (!a || !b) {
      return NextResponse.json({
        km: null,
        missing: [!a ? origin : null, !b ? destination : null].filter(Boolean),
      });
    }

    const km = haversineKm(a.lat, a.lon, b.lat, b.lon);
    return NextResponse.json({
      km,
      roundedKm: Math.round(km),
      origin,
      destination,
    });
  } catch (e) {
    console.warn("airports/distance lookup failed", e);
    return NextResponse.json({ error: "Lookup failed", km: null }, { status: 500 });
  }
}
