import { NextResponse } from "next/server";
import { optimize } from "@/lib/optimizer";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const routesInput = body.routes || [];

    if (!routesInput.length) {
      return NextResponse.json({ routes: [] });
    }

    // --- Default aircraft (expand later or pull from DB) ---
    const aircraftList = [
      {
        name: "A380",
        capacity: 600,
        speed: 1049,
        fuel: 22.26,
        co2: 0.16,
        check_cost: 12937770,
        maintenance_interval: 450,
        purchase_cost: 215629503,
      },
    ];

    // --- Company settings (can later be user-configurable) ---
    const company = {
      fuel_price: 500,
      co2_price: 120,
      fuel_training: 100,
      co2_training: 100,
      repair_training: 100,
      load: 1,
      ci: 200,
    };

    const routes = routesInput.map((r: any) => {
      const result = optimize(
        r.distance,
        {
          y: r.demand?.y ?? r.demand_y ?? 0,
          j: r.demand?.j ?? r.demand_j ?? 0,
          f: r.demand?.f ?? r.demand_f ?? 0,
        },
        aircraftList,
        company
      );

      return {
        id: r.id || Math.random().toString(),
        origin: r.origin,
        destination: r.destination,
        distance: r.distance,
        optimized: {
          total_profit_per_week: result.total_profit_per_week,
          plan: result.plan,
          marginal_values: result.marginal_values,
        },
      };
    });

    return NextResponse.json({ routes });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Optimization failed" },
      { status: 500 }
    );
  }
}