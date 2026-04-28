import { NextRequest, NextResponse } from "next/server";
import { persistRouteOptimization } from "@/lib/persist-optimization";
import { getEnrichedRouteById } from "@/lib/routes-data";

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const route = await getEnrichedRouteById(id);
    if (!route) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await persistRouteOptimization(route.id, route.optimized, route.comparison);
    return NextResponse.json({ ok: true, route });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Optimize failed" }, { status: 500 });
  }
}
