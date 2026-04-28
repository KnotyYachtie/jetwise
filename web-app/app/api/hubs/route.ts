import { sql } from "@vercel/postgres";
import { NextResponse } from "next/server";
import { HUBS } from "@/lib/hubs";
import { getEnrichedRoutes } from "@/lib/routes-data";

export async function GET() {
  try {
    const routes = await getEnrichedRoutes();
    const assignRes = await sql`SELECT route_id FROM route_assignments`;
    const countsByRoute = new Map<string, number>();
    for (const row of assignRes.rows as { route_id: string }[]) {
      countsByRoute.set(row.route_id, (countsByRoute.get(row.route_id) ?? 0) + 1);
    }

    const hubs = HUBS.map((h) => {
      const subset = routes.filter((r) => r.hub === h.icao);
      const weekly = subset.reduce((s, r) => s + (r.current.weekly_profit_per_week ?? 0), 0);
      const aircraft = subset.reduce((s, r) => s + (countsByRoute.get(r.id) ?? 0), 0);
      return {
        ...h,
        route_count: subset.length,
        aircraft_count: aircraft,
        hub_total_weekly_profit: weekly,
      };
    });

    const fleetWeekly = routes.reduce((s, r) => s + (r.current.weekly_profit_per_week ?? 0), 0);
    const fleetAc = assignRes.rows.length;
    const fleetAvgDaily = fleetAc ? fleetWeekly / fleetAc / 7 : 0;

    return NextResponse.json({
      hubs,
      fleet_average_daily_asset_yield: fleetAvgDaily,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Hubs failed" }, { status: 500 });
  }
}
