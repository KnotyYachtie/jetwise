# Fleet API (`GET /api/fleet`) — `summary` metric dictionary

This document traces **only** the seven fields returned under `summary` in `web-app/app/api/fleet/route.ts`. Values follow the actual implementation; downstream economics (`evaluateWithFixedConfig`, `evaluateAircraftOnRoute`, ticket pricing, etc.) are treated as the **source of per-aircraft / per-combo weekly profit** without restating every fuel/CO₂ formula here.

---

## Call chain (high level)

1. `GET` handler loads `company` (`getCompany`), `routes` (`getEnrichedRoutes`), and all `route_assignments` rows (`sql\`SELECT id, route_id FROM route_assignments\``).
2. Each `RoutePayload` is built in `getEnrichedRoutes` → `enrichRoute` (`route-payload.ts`): **current** weekly profit = `evaluateCurrentAssignment(...).total_profit_per_week`; **optimized** weekly profit = `optimizeRoute(...).total_profit_per_week` (among other optimized fields).
3. Fleet aggregates and comparisons are computed **only** in the fleet route handler (lines 11–47).
4. `reallocation_opportunity_count` = `suggestReallocations(...).length` (`reallocation.ts`), using a slim projection of each route’s `current.aircraft` and `optimized.marginal_a330_value` / `marginal_a380_value`.

---

## Per-field trace

### `fleet_total_weekly_profit`

- **Code:** `routes.reduce((s, r) => s + (r.current.weekly_profit_per_week ?? 0), 0)` → variable `fleetCurrent` (`fleet/route.ts` ~L13).
- **Origin of `r.current.weekly_profit_per_week`:** `enrichRoute` sets it to `cur.total_profit_per_week` where `cur = evaluateCurrentAssignment(route.distance, demand, aircraft, company)` (`route-payload.ts` ~L84–101).
- **`evaluateCurrentAssignment`:** Walks DB `aircraft` rows in order; for each, `evaluateWithFixedConfig(ac, company, distance, row.config)`; sums `fe.profit_per_week` into `total`; skips rows where `fe` is falsy (`optimizer.ts` ~L336–369).
- **Inputs:** Full enriched `routes` array; per route: distance, demand (from DB), ordered assignments → `CurrentAircraftRow[]`, `company`.
- **Formula (plain):** Sum over every route of **modeled current weekly profit** for that route’s deployed aircraft (sequential greedy on remaining demand).
- **Math:** \(\sum_{r \in \text{routes}} \text{currentWeekly}(r)\), with `?? 0` if missing.
- **Edge cases:** Routes with **no** assignments yield `evaluateCurrentAssignment` with `total = 0` (loop never adds). `?? 0` guards a missing `weekly_profit_per_week` on the payload.

---

### `fleet_optimized_weekly_profit_total`

- **Code:** `routes.reduce((s, r) => s + r.optimized.total_profit_per_week, 0)` → `fleetOpt` (`fleet/route.ts` ~L14). **No** nullish coalescing on optimized total.
- **Origin of `r.optimized.total_profit_per_week`:** `enrichRoute` calls `optimizeRoute(distance, demand, company)` and maps result through `toOptimizedApi` (`route-payload.ts` ~L85, L104).
- **`optimizeRoute`:** Enumerates integer pairs `(n380, n330)` with `1 ≤ n380+n330 ≤ MAX_AIRCRAFT_PER_ROUTE` (8); keeps the combo with highest `evaluateComboCounts` weekly total; then re-evaluates with `evaluateComboCountsEqualSplit` for the winning counts; `total_profit_per_week` is that equal-split total (or falls back to best greedy total if equal-split is null) (`optimizer.ts` ~L261–323). If no valid combo, returns `0` (`optimizer.ts` ~L280–283).
- **Inputs:** Same `routes` and `company`; per route: distance, demand.
- **Formula (plain):** Sum over every route of **best enumerated fleet mix** weekly profit (equal-split normalization on the winning mix), independent of what is actually assigned in the DB.
- **Math:** \(\sum_{r \in \text{routes}} \text{optimizedWeekly}(r)\).
- **Edge cases:** Optimizer always supplies a number (at worst `0`). This is **not** capped by actual `aircraft_count`; a route with zero DB aircraft still contributes its hypothetical optimum.

---

### `aircraft_count`

- **Code:** `assignRes.rows.length` where `assignRes = await sql\`SELECT id, route_id FROM route_assignments\`` (`fleet/route.ts` ~L11–12).
- **Formula (plain):** Total number of rows in `route_assignments` (each row is one deployed aircraft slot on some route).
- **Inputs:** Only the assignment query result — **not** deduplicated by aircraft id, not filtered by route existence.
- **Edge cases:** If the table is empty, count is `0` (see `fleet_average_daily_asset_yield` guard).

---

### `route_count`

- **Code:** `routes.length` (`fleet/route.ts` ~L44).
- **Origin of `routes`:** `getEnrichedRoutes` → `sql\`SELECT * FROM routes ORDER BY ...\`` (`routes-data.ts` ~L13–17).
- **Formula (plain):** Number of rows returned from `routes` table (all routes loaded, regardless of status field in DB — **no** `WHERE status = 'active'` in this path).
- **Edge cases:** Includes routes that may have zero assignments.

---

### `fleet_average_daily_asset_yield`

- **Code:** `const totalDailyAsset = aircraftCount ? fleetCurrent / aircraftCount / 7 : 0` (`fleet/route.ts` ~L15), exposed as `fleet_average_daily_asset_yield: totalDailyAsset` (~L45).
- **Inputs:** `fleetCurrent` (= `fleet_total_weekly_profit`), `aircraft_count` (= assignment row count).
- **Formula (plain):** Average **current** weekly profit **per assignment row**, then divided by 7 to express as a daily rate.
- **Math:** If `aircraft_count > 0`: \(\text{fleet\_total\_weekly\_profit} / (\text{aircraft\_count} \times 7)\); otherwise `0`.
- **Edge cases:** Division by zero avoided by ternary. **Not** weighted by route; double-counting is implicit if the schema allows multiple rows per “physical” aircraft (not enforced here). Denominator is **7 days**, not calendar-specific hours.

---

### `routes_below_fleet_average`

- **Code:** Loop over `routes`; `n = r.current.aircraft.length || 1`; `routeAsset = (r.current.weekly_profit_per_week ?? 0) / n / 7`; if `routeAsset < totalDailyAsset && n > 0` then `belowFleet++` (`fleet/route.ts` ~L17–22).
- **Inputs:** Same `routes` and `totalDailyAsset` as above; per route: `current.aircraft` length and `weekly_profit_per_week`.
- **Formula (plain):** Count routes where **per-slot daily current yield** (weekly profit divided by `(len(aircraft) || 1)`, then `/ 7`) is **strictly less than** fleet-wide `totalDailyAsset`.
- **Math:** For each route \(r\): \(\text{routeDaily} = \dfrac{\text{weekly}(r)}{\max(1, |aircraft(r)|)} \div 7\). Count if \(\text{routeDaily} < \text{fleet\_average\_daily\_asset\_yield}\).
- **Edge cases:**
  - Routes with **zero** aircraft: `n` becomes **1**, so `routeAsset` equals full route weekly profit ÷ 7 (same as attributing all profit to one virtual slot). The `n > 0` check is always true after `|| 1`.
  - If `aircraft_count === 0`, `totalDailyAsset === 0`; then `routeAsset < 0` only if weekly profit is negative — otherwise **no** route increments (strict `<` vs `0`).
  - Uses the same `?? 0` on weekly profit as the fleet total.

---

### `reallocation_opportunity_count`

- **Code:** `suggestions.length` where `suggestions = suggestReallocations(forRealloc, company)` (`fleet/route.ts` ~L24–37, ~L47).
- **`forRealloc` projection:** Per route: `id`, `origin`, `destination`, `distance`, `demand`, `current: { aircraft }`, `optimized: { marginal_a330_value, marginal_a380_value }` (from enriched payload).
- **`suggestReallocations` (`reallocation.ts`):**
  - Only considers **from** routes with **`current.aircraft.length >= 2`**.
  - Computes **per-aircraft marginal contributions** via `perAircraftContribution`: for each index `i`, `full.total_profit_per_week - evaluateCurrentAssignment(..., rows without i).total_profit_per_week`.
  - Picks **`sec`**, the aircraft with the **smallest** such contribution (the “weakest” hull on that route).
  - For every **other** route `to` (`to.id !== from.id`), reads `pot = marginal_a380_value` or `marginal_a330_value` matching `sec.type`. If `pot <= sec.contribution`, skip; else pushes one suggestion with `net_fleet_gain = pot - sec.contribution`.
  - Returns the full list (sorted by `net_fleet_gain` descending); **count includes every valid `(from, to, weakest-type)` pair**, not deduplicated by aircraft.
- **Formula (plain):** Number of ordered pairs *(heavy multi-aircraft route, different target route)* where moving the **lowest-contribution** current aircraft to the target’s **marginal slot value** (by type) shows strict improvement.
- **Edge cases:** Routes with fewer than two aircraft generate **no** outbound suggestions. Marginal values come from **`optimizeRoute`** equal-split baseline for that route (`optimizer.ts` marginal probe), not from DB assignment on the target route.

---

## TypeScript definitions (mirror of `summary`)

The object below is documentation-only unless you import it from a module.

```typescript
export const FleetMetricDefinitions = {
  fleet_total_weekly_profit: {
    description:
      "Sum of modeled weekly operating profit for each route using the actual DB aircraft lineup and configs (sequential evaluation on remaining demand).",
    formula: "Σ_r ( r.current.weekly_profit_per_week ?? 0 )",
    inputs: [
      "routes from getEnrichedRoutes()",
      "per-route evaluateCurrentAssignment → total_profit_per_week (via enrichRoute)",
      "company from getCompany()",
    ],
    source: "web-app/app/api/fleet/route.ts (fleetCurrent reduce); web-app/lib/route-payload.ts enrichRoute; web-app/lib/optimizer.ts evaluateCurrentAssignment",
    notes:
      "Missing weekly field coerced to 0. Rows with no valid evaluateWithFixedConfig result contribute 0 for that aircraft.",
  },

  fleet_optimized_weekly_profit_total: {
    description:
      "Sum over routes of the best-case weekly profit from the optimizer’s enumerated fleet mixes (capped mix size), using equal-split normalization on the winning combo.",
    formula: "Σ_r r.optimized.total_profit_per_week",
    inputs: [
      "routes from getEnrichedRoutes()",
      "per-route optimizeRoute(distance, demand, company)",
      "company from getCompany()",
    ],
    source: "web-app/app/api/fleet/route.ts (fleetOpt reduce); web-app/lib/route-payload.ts enrichRoute; web-app/lib/optimizer.ts optimizeRoute",
    notes:
      "No ?? on optimized total; optimizeRoute returns 0 when no feasible combo. Independent of route_assignments counts.",
  },

  aircraft_count: {
    description:
      "Raw count of assignment rows in route_assignments (each row represents one deployed aircraft entry on a route).",
    formula: "COUNT(*) AS route_assignments rows selected",
    inputs: ["SQL result of SELECT id, route_id FROM route_assignments"],
    source: "web-app/app/api/fleet/route.ts assignRes.rows.length",
    notes: "Not distinct aircraft IDs; not filtered by route table.",
  },

  route_count: {
    description: "Number of rows in the routes table included in this fleet snapshot.",
    formula: "routes.length",
    inputs: ["getEnrichedRoutes → SELECT * FROM routes"],
    source: "web-app/app/api/fleet/route.ts routes.length; web-app/lib/routes-data.ts getEnrichedRoutes",
    notes: "No status filter in SQL; includes all returned routes.",
  },

  fleet_average_daily_asset_yield: {
    description:
      "Fleet total current weekly profit divided by total assignment rows, then divided by 7 to express an average daily figure per assignment row.",
    formula: "aircraft_count > 0 ? fleet_total_weekly_profit / aircraft_count / 7 : 0",
    inputs: ["fleet_total_weekly_profit", "aircraft_count"],
    source: "web-app/app/api/fleet/route.ts totalDailyAsset",
    notes: "If aircraft_count is 0, value is 0. Denominator is 7 calendar days, not flying hours.",
  },

  routes_below_fleet_average: {
    description:
      "Count of routes whose per-slot daily current yield (weekly profit divided by max(1, number of current aircraft), then /7) is strictly below the fleet-wide average daily asset yield.",
    formula:
      "COUNT_r ( ( (r.current.weekly_profit_per_week ?? 0) / (r.current.aircraft.length || 1) / 7 ) < fleet_average_daily_asset_yield && (r.current.aircraft.length || 1) > 0 )",
    inputs: [
      "routes",
      "fleet_average_daily_asset_yield (totalDailyAsset)",
      "r.current.aircraft",
      "r.current.weekly_profit_per_week",
    ],
    source: "web-app/app/api/fleet/route.ts belowFleet loop",
    notes:
      "Zero-aircraft routes use divisor 1 (|| 1), so their 'per-slot' yield equals full route weekly/7. The n > 0 guard is redundant after || 1. Strict inequality vs fleet average.",
  },

  reallocation_opportunity_count: {
    description:
      "Number of (from_route, to_route) suggestions emitted by suggestReallocations: multi-aircraft routes only, weakest hull’s contribution compared to target route’s marginal A330/A380 value.",
    formula: "suggestReallocations(forRealloc, company).length",
    inputs: [
      "routes projected to RouteForRealloc (distance, demand, current.aircraft, optimized marginals)",
      "company",
      "per-aircraft contributions via evaluateCurrentAssignment deltas",
    ],
    source: "web-app/app/api/fleet/route.ts suggestions; web-app/lib/reallocation.ts suggestReallocations",
    notes:
      "Requires >= 2 aircraft on from route. One suggestion per qualifying (from,to) pair with strict marginal gain. Sorted list length equals count (no separate cap).",
  },
} as const;
```
