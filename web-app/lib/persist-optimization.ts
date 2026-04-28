import { sql } from "@vercel/postgres";
import type { OptimizedApi } from "./route-payload";
import type { ComparisonResult } from "./optimizer";

export async function persistRouteOptimization(
  routeId: string,
  optimized: OptimizedApi,
  comparison: ComparisonResult
) {
  const payload = { optimized, comparison };
  await sql`
    INSERT INTO route_optimizations (route_id, calculated_at, result_json)
    VALUES (${routeId}, NOW(), ${JSON.stringify(payload)})
    ON CONFLICT (route_id) DO UPDATE SET
      calculated_at = EXCLUDED.calculated_at,
      result_json = EXCLUDED.result_json
  `;
}
