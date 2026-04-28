import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { HUBS } from "@/lib/hubs";
import { getEnrichedRoutes } from "@/lib/routes-data";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ icao: string }> }
) {
  try {
    const { icao } = await context.params;
    const upper = icao.toUpperCase();
    const meta = HUBS.find((h) => h.icao === upper);
    if (!meta) {
      return NextResponse.json({ error: "Unknown hub" }, { status: 404 });
    }

    const routes = await getEnrichedRoutes();
    const subset = routes.filter((r) => r.hub === upper);
    const assignRes = await sql`SELECT route_id FROM route_assignments`;
    const countsByRoute = new Map<string, number>();
    for (const row of assignRes.rows as { route_id: string }[]) {
      countsByRoute.set(row.route_id, (countsByRoute.get(row.route_id) ?? 0) + 1);
    }

    const aircraft = subset.reduce((s, r) => s + (countsByRoute.get(r.id) ?? 0), 0);
    const weekly = subset.reduce((s, r) => s + (r.current.weekly_profit_per_week ?? 0), 0);
    const fleetWeekly = routes.reduce((s, r) => s + (r.current.weekly_profit_per_week ?? 0), 0);
    const fleetAc = assignRes.rows.length;
    const fleetAvgDaily = fleetAc ? fleetWeekly / fleetAc / 7 : 0;
    const hubAvgDaily = aircraft ? weekly / aircraft / 7 : 0;

    return NextResponse.json({
      hub: meta,
      routes: subset,
      aircraft_count: aircraft,
      hub_total_weekly_profit: weekly,
      hub_average_daily_asset_yield: hubAvgDaily,
      fleet_average_daily_asset_yield: fleetAvgDaily,
      vs_fleet_daily_yield_delta: hubAvgDaily - fleetAvgDaily,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Hub detail failed" }, { status: 500 });
  }
}
