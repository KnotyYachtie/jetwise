import { sql } from "@vercel/postgres";
import { NextResponse } from "next/server";
import { getCompany } from "@/lib/company";
import { suggestReallocations } from "@/lib/reallocation";
import { getEnrichedRoutes } from "@/lib/routes-data";

export async function GET() {
  try {
    const company = await getCompany();
    const routes = await getEnrichedRoutes();
    const assignRes = await sql`SELECT id, route_id FROM route_assignments`;
    const aircraftCount = assignRes.rows.length;
    const fleetCurrent = routes.reduce((s, r) => s + (r.current.weekly_profit_per_week ?? 0), 0);
    const fleetOpt = routes.reduce((s, r) => s + r.optimized.total_profit_per_week, 0);
    const totalDailyAsset = aircraftCount ? fleetCurrent / aircraftCount / 7 : 0;

    let belowFleet = 0;
    for (const r of routes) {
      const n = r.current.aircraft.length || 1;
      const routeAsset = (r.current.weekly_profit_per_week ?? 0) / n / 7;
      if (routeAsset < totalDailyAsset && n > 0) belowFleet += 1;
    }

    const forRealloc = routes.map((r) => ({
      id: r.id,
      origin: r.origin,
      destination: r.destination,
      distance: r.distance,
      demand: r.demand,
      current: { aircraft: r.current.aircraft },
      optimized: {
        marginal_a330_value: r.optimized.marginal_a330_value,
        marginal_a380_value: r.optimized.marginal_a380_value,
      },
    }));

    const suggestions = suggestReallocations(forRealloc, company);

    return NextResponse.json({
      summary: {
        fleet_total_weekly_profit: fleetCurrent,
        fleet_optimized_weekly_profit_total: fleetOpt,
        aircraft_count: aircraftCount,
        route_count: routes.length,
        fleet_average_daily_asset_yield: totalDailyAsset,
        routes_below_fleet_average: belowFleet,
        reallocation_opportunity_count: suggestions.length,
      },
      suggestions,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Fleet failed" }, { status: 500 });
  }
}
