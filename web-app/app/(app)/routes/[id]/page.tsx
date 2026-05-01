/**
 * =============================================================================
 * ROUTE DETAIL PAGE — What this file is
 * =============================================================================
 * This is the screen you see when you open a single route (e.g. /routes/abc-123).
 * It is a “client” page: it runs in the browser, can use buttons and links, and
 * fetches live data from your API after the page loads.
 *
 * Rough layout (top → bottom):
 *   1) Action row — Persist optimization, Edit, Delete
 *   2) Hero card — Airport codes, names, distance, flight time, trips/week
 *   3) Current assignment snapshot — money + per-trip blend for what you fly now
 *   4) Optimization opportunity — model “best” fleet vs current + demand %
 *   5) Route model context — rank among all routes, delta, demand & ticket inputs
 *   6) Current assignment lines — one card per aircraft actually assigned
 *   7) Optimized mix — one card per aircraft in the model’s recommended fleet
 *
 * Small reusable pieces at the bottom of the file:
 *   TripCostParts, FleetLineDetail, Stat, MetricMini — building blocks for labels + numbers.
 * =============================================================================
 */

"use client";

// --- Imports: other files we depend on (UI, API helper, formatting, constants) ---
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { JwCard } from "@/components/JwCard";
import { api } from "@/lib/api-client";
import { shortenAirportHeadline } from "@/lib/airport-display-labels";
import { pct, usd } from "@/lib/format";
import { MAX_AIRCRAFT_PER_ROUTE } from "@/lib/optimizer";

/*
 * -----------------------------------------------------------------------------
 * TYPE DEFINITIONS (shape of data — like a form template)
 * -----------------------------------------------------------------------------
 * These describe what we expect the server to send back. They don’t display
 * anything by themselves; they help the editor catch mistakes and document fields.
 * -----------------------------------------------------------------------------
 */

type TripCostBreakdown = {
  fuel: number;
  co2: number;
  acheck: number;
  repair: number;
  total: number;
};

type FleetEconomicsRow = {
  type: string;
  config: { y: number; j: number; f: number };
  trips_per_week: number;
  flight_time_hours: number;
  revenue_per_flight: number;
  cost_per_flight: number;
  cost_breakdown: TripCostBreakdown;
  profit_per_flight: number;
  profit_per_hour: number;
  profit_per_week: number;
};

type RouteRes = {
  route: {
    id: string;
    origin: string;
    destination: string;
    origin_airport_name?: string | null;
    destination_airport_name?: string | null;
    distance: number;
    hub: string | null;
    demand: { y: number; j: number; f: number };
    prices: { y: number; j: number; f: number };
    current: {
      aircraft: { type: string; config: { y: number; j: number; f: number } }[];
      economics_rows: FleetEconomicsRow[];
      weekly_profit_per_week?: number;
      demand_fulfilled_pct?: number;
    };
    optimized: {
      fleet_mix: FleetEconomicsRow[];
      marginal_a330_value: number;
      marginal_a380_value: number;
        scheduling: {
        flight_time_hours: number;
        trips_per_week: number;
        trip_bracket: number;
      };
      total_profit_per_week: number;
      demand_fulfilled_optimized: number;
    };
    comparison: {
      delta_per_week: number;
      current_demand_fulfilled: number;
      optimized_demand_fulfilled: number;
    };
  };
};

type RouteListBench = {
  id: string;
  current: { weekly_profit_per_week?: number };
  optimized: { total_profit_per_week: number };
};

/*
 * -----------------------------------------------------------------------------
 * HELPER FUNCTIONS (pure math / labels — used by the main page)
 * -----------------------------------------------------------------------------
 */

/**
 * For each “aircraft line” we know trips/week. This builds one synthetic “average trip”
 * by weighting each line’s per-trip numbers by how many rotations that line flies.
 * Returns null if nothing flies (no trips/week), so the UI can hide the blended box.
 */
function weightedTripEconomics(rows: FleetEconomicsRow[]) {
  const rotations = rows.reduce((s, r) => s + r.trips_per_week, 0);
  if (rotations <= 0) return null;
  const weighted = (pick: (r: FleetEconomicsRow) => number) =>
    rows.reduce((s, r) => s + pick(r) * r.trips_per_week, 0) / rotations;
  return {
    rotations_per_week: rotations,
    gross_per_trip: weighted((r) => r.revenue_per_flight),
    net_per_trip: weighted((r) => r.profit_per_flight),
    cost_per_trip: weighted((r) => r.cost_per_flight),
    breakdown: {
      fuel: weighted((r) => r.cost_breakdown.fuel),
      co2: weighted((r) => r.cost_breakdown.co2),
      acheck: weighted((r) => r.cost_breakdown.acheck),
      repair: weighted((r) => r.cost_breakdown.repair),
    },
  };
}

/** Builds a short text like "A380×2 · A330×1" from the optimized fleet rows. */
function fleetTypeSummary(rows: FleetEconomicsRow[]): string {
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.type, (m.get(r.type) ?? 0) + 1);
  return [...m.entries()].map(([t, n]) => `${t}×${n}`).join(" · ") || "—";
}

/** Human-friendly aircraft variant for titles (e.g. card headings). */
function aircraftVariantLabel(type: string): string {
  if (type === "A380") return "A380-800";
  if (type === "A330") return "A330-800";
  return type;
}

/** Longer marketing-style name under the variant. */
function aircraftFullName(type: string): string {
  if (type === "A380") return "Airbus A380-800";
  if (type === "A330") return "Airbus A330-800";
  return type;
}

/** Formats money per hour; large values show as $X.Xk / hr for readability. */
function usdKPerHour(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}k / hr`;
  return `${sign}${usd(abs, { maximumFractionDigits: 0 })} / hr`;
}

/*
 * -----------------------------------------------------------------------------
 * MAIN PAGE COMPONENT — RouteDetailPage
 * -----------------------------------------------------------------------------
 * This function returns everything you see on screen. React calls it whenever
 * state changes (e.g. after data loads).
 * -----------------------------------------------------------------------------
 */
export default function RouteDetailPage() {
  // URL → which route: /routes/[id] puts the id in the address bar; we read it here.
  const params = useParams();
  const id = String(params.id);
  // router lets us navigate after delete (e.g. go back to the list).
  const router = useRouter();

  // --- State: values that can change over time and trigger a re-render ---
  // data = full API response for this route, or null while loading / on error.
  const [data, setData] = useState<RouteRes | null>(null);
  // allRoutes = lightweight list of every route (for ranking this route vs others).
  const [allRoutes, setAllRoutes] = useState<RouteListBench[]>([]);
  // err = error message string, or null if things are OK.
  const [err, setErr] = useState<string | null>(null);

  /**
   * load — Fetches this route’s details AND the full route list (for ranks).
   * Called on first paint and whenever `id` changes.
   */
  async function load() {
    setErr(null);
    try {
      const j = await api<RouteRes>(`/api/routes/${id}`);
      setData(j);
      const list = await api<{ routes: RouteListBench[] }>("/api/routes");
      setAllRoutes(list.routes ?? []);
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  // When the page opens or the route id in the URL changes, load fresh data.
  useEffect(() => {
    void load();
  }, [id]);

  /** Delete route: asks for confirmation, calls API, then returns to /routes. */
  async function remove() {
    if (!confirm("Delete this route?")) return;
    await api(`/api/routes/${id}`, { method: "DELETE" });
    router.push("/routes");
  }

  /**
   * persistOpt — Saves the optimizer’s recommended aircraft lineup to the database
   * (server endpoint), then reloads so “current” matches what was persisted.
   */
  async function persistOpt() {
    await api(`/api/routes/${id}/optimize`, { method: "POST" });
    await load();
  }

  // --- Early exit: while loading or if the request failed, show a simple card ---
  if (err || !data) {
    return (
      <JwCard title="Route" subtitle={err ? String(err) : "Loading"}>
        {err ? <p className="text-sm text-orange-400">{err}</p> : <p className="text-sm text-zinc-500">…</p>}
      </JwCard>
    );
  }

  // --- Unpack API fields into short names used throughout the JSX below ---
  const r = data.route;
  const opt = r.optimized;
  const comp = r.comparison;
  // economics_rows / fleet_mix = one object per aircraft line (current vs optimized).
  const currentRows = r.current.economics_rows ?? [];
  const optimizedRows = opt.fleet_mix ?? [];

  /*
   * --- Derived numbers: weekly totals and “profit per flight-hour” ---
   * We sum (per-line stat × that line’s trips per week) to get fleet-level weekly
   * revenue/cost/hours on this route. Profit/hour = weekly profit ÷ weekly flight hours.
   */
  const currentRevenuePerWeek = currentRows.reduce(
    (sum, row) => sum + row.revenue_per_flight * row.trips_per_week,
    0
  );
  const currentCostPerWeek = currentRows.reduce(
    (sum, row) => sum + row.cost_per_flight * row.trips_per_week,
    0
  );
  const currentFlightHoursPerWeek = currentRows.reduce(
    (sum, row) => sum + row.flight_time_hours * row.trips_per_week,
    0
  );
  const currentProfitPerHour =
    currentFlightHoursPerWeek > 0 ? (r.current.weekly_profit_per_week ?? 0) / currentFlightHoursPerWeek : 0;

  const optimizedRevenuePerWeek = optimizedRows.reduce(
    (sum, row) => sum + row.revenue_per_flight * row.trips_per_week,
    0
  );
  const optimizedCostPerWeek = optimizedRows.reduce(
    (sum, row) => sum + row.cost_per_flight * row.trips_per_week,
    0
  );
  const optimizedFlightHoursPerWeek = optimizedRows.reduce(
    (sum, row) => sum + row.flight_time_hours * row.trips_per_week,
    0
  );
  const optimizedProfitPerHour =
    optimizedFlightHoursPerWeek > 0 ? opt.total_profit_per_week / optimizedFlightHoursPerWeek : 0;
  const configLeakPerWeek = (opt.total_profit_per_week ?? 0) - (r.current.weekly_profit_per_week ?? 0);

  // Blended “typical trip” economics (weighted by how often each line flies per week).
  const currentTripBlend = weightedTripEconomics(currentRows);
  const optimizedTripBlend = weightedTripEconomics(optimizedRows);

  /*
   * --- Rankings: sort all routes by weekly profit, find this route’s position ---
   * Ranks are 1-based (#1 = best). routeCount avoids divide-by-zero in labels.
   */
  const sortableCurrent = allRoutes
    .map((x) => ({ id: x.id, value: x.current?.weekly_profit_per_week ?? 0 }))
    .sort((a, b) => b.value - a.value);
  const sortableOptimized = allRoutes
    .map((x) => ({ id: x.id, value: x.optimized?.total_profit_per_week ?? 0 }))
    .sort((a, b) => b.value - a.value);
  const currentRank = sortableCurrent.findIndex((x) => x.id === r.id) + 1;
  const optimizedRank = sortableOptimized.findIndex((x) => x.id === r.id) + 1;
  const routeCount = Math.max(allRoutes.length, 1);
  const currentRankLabel = currentRank > 0 ? `#${currentRank}/${routeCount}` : "—";
  const optimizedRankLabel = optimizedRank > 0 ? `#${optimizedRank}/${routeCount}` : "—";

  // Optional prettier airport names (shortened) when the API resolved them from the DB.
  const originHeadline =
    r.origin_airport_name != null && r.origin_airport_name !== ""
      ? shortenAirportHeadline(r.origin_airport_name)
      : null;
  const destHeadline =
    r.destination_airport_name != null && r.destination_airport_name !== ""
      ? shortenAirportHeadline(r.destination_airport_name)
      : null;

  // --- Main page markup (JSX): HTML-like structure; className = visual styling ---
  return (
    <div className="space-y-4">
      {/* ================================================================
          TOP TOOLBAR — Actions (not part of the big hero card)
          Persist = write optimizer result to DB; Edit = open composer; Delete = remove route
          ================================================================ */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void persistOpt()}
          className="rounded-xl border border-cyan-400/40 bg-cyan-500/15 px-3 py-1.5 text-sm font-semibold text-cyan-100"
        >
          Persist optimization
        </button>
        <Link
          href={`/routes/new?edit=${r.id}`}
          className="rounded-xl border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300"
        >
          Edit
        </Link>
        <button
          type="button"
          onClick={() => void remove()}
          className="rounded-xl border border-orange-500/40 px-3 py-1.5 text-sm text-orange-300"
        >
          Delete
        </button>
      </div>

      {/* ================================================================
          HERO CARD — Whole route story in one framed block (gradient border, blur)
          ================================================================ */}
      <section className="overflow-hidden rounded-3xl border border-cyan-500/20 bg-[linear-gradient(160deg,rgba(6,18,24,0.96),rgba(5,13,20,0.92))] shadow-[0_0_90px_-30px_rgba(34,211,238,0.35)] backdrop-blur-xl">
        {/* Hero header strip: hub label, origin ↔ plane icon ↔ destination, distance & schedule */}
        <div className="relative border-b border-cyan-500/20 bg-[radial-gradient(120%_90%_at_50%_120%,rgba(28,190,196,0.33),transparent_62%),linear-gradient(180deg,rgba(11,28,39,0.98)_0%,rgba(8,23,31,0.92)_45%,rgba(8,45,53,0.72)_100%)] p-4 sm:p-6">
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-7 bg-gradient-to-t from-cyan-300/10 to-transparent" />
          <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-400">{r.hub ?? "Unassigned hub"}</p>
          <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <div>
              <p className="font-mono text-3xl font-semibold tracking-wide text-white">{r.origin}</p>
              <p className="mt-1 text-xs text-zinc-300">📍 {originHeadline ?? r.origin}</p>
            </div>
            <div className="flex min-w-[88px] flex-col items-center justify-center">
              <div className="h-px w-full bg-gradient-to-r from-transparent via-cyan-300/70 to-transparent" />
              <div className="-mt-2 rounded-full border border-cyan-300/55 bg-[#06131c]/80 p-1.5 shadow-[0_0_18px_-8px_rgba(34,211,238,0.8)]">
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden
                  className="h-4 w-4 text-cyan-200"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 11.3 20.2 4.2a.8.8 0 0 1 1 .98l-3.05 8.36a2.1 2.1 0 0 1-1.23 1.24l-8.38 3.05a.8.8 0 0 1-.98-1l2.03-4.95-4.61-1.02a.8.8 0 0 1 0-1.57l4.6-1.03 2.05-4.95a.8.8 0 0 1 1.5.58L12.2 8.3l4.31.96a.8.8 0 0 1 0 1.56l-4.3.96-1.1 2.68 4.62-1.69a.7.7 0 0 0 .41-.41l1.69-4.62-2.68 1.1-.96 4.3a.8.8 0 0 1-1.56 0l-.96-4.31-2.67 1.1-1.69 4.62a.8.8 0 0 1-1.5-.57l2.03-4.95-2.54-.56Z" />
                </svg>
              </div>
              <div className="-mt-2 h-px w-full bg-gradient-to-r from-transparent via-cyan-300/70 to-transparent" />
            </div>
            <div className="text-right">
              <p className="font-mono text-3xl font-semibold tracking-wide text-white">{r.destination}</p>
              <p className="mt-1 text-xs text-zinc-300">📍 {destHeadline ?? r.destination}</p>
            </div>
          </div>
            <p className="mt-3 text-sm text-zinc-300">
            {Math.round(r.distance)} km · {opt.scheduling.flight_time_hours.toFixed(2)}h one-way · trips/wk{" "}
            {opt.scheduling.trips_per_week}
          </p>
        </div>

        {/* Body of the hero: stacked sections with dividers */}
        <div className="space-y-6 p-4 sm:p-6">
          {/* --- Section A: What you make now (totals + weighted per-trip breakdown) --- */}
          <section>
            <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Current assignment snapshot</p>
            {/* Four headline numbers: weekly roll-ups + profit per block hour in the air */}
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Stat title="Revenue / wk" value={usd(currentRevenuePerWeek)} />
              <Stat title="Cost / wk" value={usd(currentCostPerWeek)} />
              <Stat title="Profit / wk" value={usd(r.current.weekly_profit_per_week ?? 0)} />
              <Stat title="Profit / flight-hour" value={usd(currentProfitPerHour)} />
            </div>
            {currentTripBlend ? (
              <div className="mt-3 rounded-xl border border-zinc-800/90 bg-black/25 p-3">
                <p className="text-[10px] uppercase tracking-widest text-zinc-500">
                  Per trip · weighted by {currentTripBlend.rotations_per_week.toFixed(0)} rotations / wk
                </p>
                <div className="mt-2 grid gap-3 sm:grid-cols-3">
                  <MetricMini title="Gross / trip" value={usd(currentTripBlend.gross_per_trip)} />
                  <div>
                    <MetricMini title="Cost / trip" value={usd(currentTripBlend.cost_per_trip)} />
                    <TripCostParts bd={currentTripBlend.breakdown} />
                  </div>
                  <MetricMini title="Net / trip" value={usd(currentTripBlend.net_per_trip)} tone="good" />
                </div>
              </div>
            ) : null}
          </section>

          {/* --- Section B: Model optimum vs today (leak, profit/hr, demand %) --- */}
          <section className="border-t border-zinc-800/80 pt-5">
            <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Optimization opportunity</p>
            {/* Optimized weekly profit, money left on table, model profit/hour, demand % before→after */}
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Stat title="Optimized profit / wk" value={usd(opt.total_profit_per_week)} />
              <Stat title="Leak vs current / wk" value={usd(configLeakPerWeek)} highlight />
              <Stat title="Optimized profit / flight-hour" value={usd(optimizedProfitPerHour)} />
              <Stat title="Demand fulfilled" value={`${pct(comp.current_demand_fulfilled)} → ${pct(comp.optimized_demand_fulfilled)}`} />
            </div>
            {optimizedTripBlend ? (
              <div className="mt-3 rounded-xl border border-cyan-400/25 bg-cyan-400/[0.06] p-3">
                <p className="text-[10px] uppercase tracking-widest text-cyan-100/85">
                  Optimized per trip · weighted by {optimizedTripBlend.rotations_per_week.toFixed(0)} rotations / wk
                </p>
                <div className="mt-2 grid gap-3 sm:grid-cols-3">
                  <MetricMini title="Gross / trip" value={usd(optimizedTripBlend.gross_per_trip)} />
                  <div>
                    <MetricMini title="Cost / trip" value={usd(optimizedTripBlend.cost_per_trip)} />
                    <TripCostParts bd={optimizedTripBlend.breakdown} accent="cyan" />
                  </div>
                  <MetricMini title="Net / trip" value={usd(optimizedTripBlend.net_per_trip)} tone="good" />
                </div>
              </div>
            ) : null}
          </section>

          {/* --- Section C: How this route ranks fleet-wide + inputs the model used --- */}
          <section className="border-t border-zinc-800/80 pt-5">
            <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Route model context</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Stat title="Current rank" value={currentRankLabel} />
              <Stat title="Optimized rank" value={optimizedRankLabel} />
              <Stat title="Delta vs current" value={usd(comp.delta_per_week)} highlight />
              <Stat title="Bracket (~daily eq)" value={String(opt.scheduling.trip_bracket)} />
            </div>
            <p className="mt-3 text-xs text-zinc-400">
              Demand Y {r.demand.y} · J {r.demand.j} · F {r.demand.f} · Ticket Y {usd(r.prices.y)} · J {usd(r.prices.j)} · F {usd(r.prices.f)}
            </p>
          </section>

          {/* --- Section D: One card per aircraft actually assigned (from DB) --- */}
          <section className="border-t border-zinc-800/80 pt-5">
            <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Current assignment lines</p>
            <ul className="mt-3 grid grid-cols-2 gap-2 text-sm">
              {/* map = “for each aircraft row, draw one FleetLineDetail card” */}
              {currentRows.length ? (
                currentRows.map((a, i) => (
                  <FleetLineDetail
                    key={i}
                    row={a}
                    variant="muted"
                    title={`${aircraftVariantLabel(a.type)} ${r.origin}-${r.destination}-${i + 1}`}
                    subtitle={aircraftFullName(a.type)}
                    prices={r.prices}
                  />
                ))
              ) : (
                <p className="text-sm text-zinc-500">No airframes assigned</p>
              )}
            </ul>
          </section>

          {/* --- Section E: One card per aircraft in the solver’s recommended mix --- */}
          <section className="border-t border-zinc-800/80 pt-5">
            <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Optimized mix</p>
            <p className="mt-1 text-xs text-zinc-400">
              {fleetTypeSummary(optimizedRows)} </p>
            <ul className="mt-3 grid grid-cols-2 gap-2 text-sm">
              {/* Same pattern as current lines, but data comes from the solver’s fleet_mix */}
              {opt.fleet_mix.length ? (
                opt.fleet_mix.map((a, i) => (
                  <FleetLineDetail
                    key={i}
                    row={a}
                    variant="optimized"
                    title={`${aircraftVariantLabel(a.type)} ${r.origin}-${r.destination}-${i + 1}`}
                    subtitle={aircraftFullName(a.type)}
                    prices={r.prices}
                  />
                ))
              ) : (
                <p className="text-sm text-zinc-500">No profitable mix in model</p>
              )}
            </ul>
          </section>
        </div>
      </section>
    </div>
  );
}

/*
 * -----------------------------------------------------------------------------
 * SMALL UI COMPONENTS (building blocks — used multiple times on this page)
 * -----------------------------------------------------------------------------
 */

/**
 * Lists the four cost buckets (fuel, CO₂, A-Check, repair) under “Cost / trip”
 * in the blended summary boxes. `accent` only changes text color (cyan vs zinc).
 */
function TripCostParts({
  bd,
  accent = "zinc",
}: {
  bd: { fuel: number; co2: number; acheck: number; repair: number };
  accent?: "zinc" | "cyan";
}) {
  const val = accent === "cyan" ? "text-cyan-100/90" : "text-zinc-300";
  return (
    <ul className="mt-2 space-y-1 border-t border-zinc-800/80 pt-2 text-[11px] text-zinc-500">
      <li className="flex justify-between gap-3">
        <span>Fuel</span>
        <span className={`font-mono ${val}`}>{usd(bd.fuel)}</span>
      </li>
      <li className="flex justify-between gap-3">
        <span>CO₂</span>
        <span className={`font-mono ${val}`}>{usd(bd.co2)}</span>
      </li>
      <li className="flex justify-between gap-3">
        <span>A-Check</span>
        <span className={`font-mono ${val}`}>{usd(bd.acheck)}</span>
      </li>
      <li className="flex justify-between gap-3">
        <span>Repair</span>
        <span className={`font-mono ${val}`}>{usd(bd.repair)}</span>
      </li>
    </ul>
  );
}

/**
 * One aircraft “line” card: title, cabin counts, ticket prices, trip stats,
 * gross / cost / net per trip and per week. `variant` picks muted vs cyan styling.
 */
function FleetLineDetail({
  row,
  variant,
  title,
  subtitle,
  prices,
}: {
  row: FleetEconomicsRow;
  variant: "muted" | "optimized";
  title: string;
  subtitle: string;
  prices: { y: number; j: number; f: number };
}) {
  const wrap =
    variant === "optimized"
      ? "rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-2.5 text-cyan-50"
      : "rounded-lg border border-zinc-800 bg-black/30 p-2.5 text-zinc-200";
  const sub = "text-zinc-400";
  const bd = row.cost_breakdown;
  return (
    <li className={`${wrap} font-mono text-xs`}>
      <div className="text-[13px] leading-snug text-white/90">{title}</div>
      <div className="mt-0.5 text-[11px] text-zinc-400">{subtitle}</div>
      <div className="mt-1 text-[11px] text-zinc-300">
        Y{row.config.y} J{row.config.j} F{row.config.f}
      </div>
      <div className="mt-0.5 text-[10px] text-zinc-500">
        Ticket prices Y {usd(prices.y)} · J {usd(prices.j)} · F {usd(prices.f)}
      </div>
      <div className={`mt-1 text-[11px] ${sub}`}>
        {row.trips_per_week} t/wk · {row.flight_time_hours.toFixed(2)}h · {usdKPerHour(row.profit_per_hour)}
      </div>
      <div className="mt-2 grid gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-500">Gross / trip</p>
          <p className="mt-0.5 font-mono text-[13px] text-zinc-100">{usd(row.revenue_per_flight)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-500">Cost / trip</p>
          <p className="mt-0.5 font-mono text-[13px]">{usd(row.cost_per_flight)}</p>
          <p className="mt-1 text-[10px] leading-relaxed text-zinc-500">
            Fuel {usd(bd.fuel)} · CO₂ {usd(bd.co2)} · A-Check {usd(bd.acheck)} · Repair {usd(bd.repair)}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-500">Net / trip</p>
            <p className="mt-0.5 font-mono text-[13px] text-emerald-200/90">{usd(row.profit_per_flight)}</p>
          </div>
          <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-500">Net / week</p>
            <p className="mt-0.5 font-mono text-[13px] text-emerald-200/90">{usd(row.profit_per_week)}</p>
          </div>
        </div>
      </div>
    </li>
  );
}

/** Simple labeled box: small CAPS label on top, big monospace value below. */
function Stat({
  title,
  value,
  /** When true, value text uses cyan accent (used for “important” deltas). */
  highlight = false,
}: {
  title: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-lg border border-zinc-800/80 bg-black/20 p-3">
      <p className="text-[10px] uppercase tracking-widest text-zinc-500">{title}</p>
      <p className={highlight ? "mt-1 font-mono text-cyan-200" : "mt-1 font-mono text-zinc-200"}>{value}</p>
    </div>
  );
}

/** Compact label + value (used inside the blended per-trip rows). */
function MetricMini({
  title,
  value,
  tone = "neutral",
}: {
  title: string;
  value: string;
  tone?: "neutral" | "good";
}) {
  const cls = tone === "good" ? "text-emerald-200/90" : "text-zinc-100";
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-zinc-500">{title}</p>
      <p className={`mt-0.5 font-mono text-sm ${cls}`}>{value}</p>
    </div>
  );
}
