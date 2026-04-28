import { NextResponse } from "next/server";
import { getCompany } from "@/lib/company";
import { persistRouteOptimization } from "@/lib/persist-optimization";
import { getEnrichedRoutes } from "@/lib/routes-data";

export async function POST() {
  try {
    const company = await getCompany();
    const routes = await getEnrichedRoutes();
    for (const r of routes) {
      await persistRouteOptimization(r.id, r.optimized, r.comparison);
    }
    return NextResponse.json({ ok: true, routes, company });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Optimize all failed" }, { status: 500 });
  }
}
