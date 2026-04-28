import { sql } from "@vercel/postgres";
import { type NextRequest, NextResponse } from "next/server";
import { filterHubsByQuery, formatHubLine } from "@/lib/hubs";
import { formatAirportLine } from "@/lib/location-labels";
import type { AirportSearchResult } from "@/lib/airport-search";
import { checkSearchRateLimit, clientIpFromHeaders } from "@/lib/rate-limit-ip";

type SearchResult = AirportSearchResult;

function matchingHubs(q: string): SearchResult[] {
  return filterHubsByQuery(q).map((h) => ({
    icao: h.icao,
    label: formatHubLine(h),
    kind: "hub" as const,
  }));
}

export async function GET(request: NextRequest) {
  const ip = clientIpFromHeaders(request.headers);
  const limit = checkSearchRateLimit(ip);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfter: limit.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec ?? 60) } }
    );
  }

  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
  const hubPart = matchingHubs(q);

  if (q.length < 2) {
    return NextResponse.json({ results: hubPart });
  }

  const qu = q.toUpperCase();
  const pattern = `%${qu}%`;
  const starts = `${qu}%`;

  try {
    const ext = await sql`
      SELECT icao, name, city, country, iata
      FROM airport_lookup
      WHERE icao ILIKE ${pattern}
         OR NULLIF(TRIM(iata), '') IS NOT NULL AND TRIM(iata) ILIKE ${pattern}
         OR name ILIKE ${pattern}
         OR city ILIKE ${pattern}
         OR country ILIKE ${pattern}
      ORDER BY
        CASE
          WHEN NULLIF(TRIM(iata), '') IS NOT NULL AND UPPER(TRIM(iata)) = ${qu} THEN 0
          WHEN UPPER(icao) = ${qu} THEN 1
          WHEN NULLIF(TRIM(iata), '') IS NOT NULL AND TRIM(iata) ILIKE ${starts} THEN 2
          WHEN icao ILIKE ${starts} THEN 3
          WHEN name ILIKE ${starts} THEN 4
          WHEN name ILIKE ${pattern} THEN 5
          WHEN city ILIKE ${pattern} THEN 6
          WHEN country ILIKE ${pattern} THEN 7
          ELSE 8
        END,
        CASE WHEN icao ~ '^[0-9]' THEN 1 ELSE 0 END,
        CASE WHEN NULLIF(TRIM(iata), '') IS NULL THEN 1 ELSE 0 END,
        icao ASC
      LIMIT 30
    `;
    const seen = new Set(hubPart.map((h) => h.icao));
    const fromDb: AirportSearchResult[] = ext.rows
      .filter((r) => !seen.has((r as { icao: string }).icao))
      .map((r) => {
        const row = r as {
          icao: string;
          name: string;
          city: string | null;
          country: string | null;
          iata: string | null;
        };
        return {
          icao: row.icao,
          label: formatAirportLine({
            icao: row.icao,
            name: row.name,
            countryIso2: row.country ?? "",
            city: row.city,
          }),
          kind: "airport" as const,
        };
      });
    return NextResponse.json({ results: [...hubPart, ...fromDb] });
  } catch (e) {
    console.warn("airport_lookup query failed (table missing?)", e);
    return NextResponse.json({ results: hubPart });
  }
}
