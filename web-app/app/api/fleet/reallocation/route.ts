import { NextResponse } from "next/server";
import { getCompany } from "@/lib/company";
import { suggestReallocations } from "@/lib/reallocation";
import { getEnrichedRoutes } from "@/lib/routes-data";

export async function GET() {
  try {
    const company = await getCompany();
    const routes = await getEnrichedRoutes();
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
    return NextResponse.json({ suggestions: suggestReallocations(forRealloc, company) });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Reallocation failed" }, { status: 500 });
  }
}
