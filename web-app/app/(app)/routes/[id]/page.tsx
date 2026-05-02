"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  BadgeDollarSign,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Clock3,
  Coins,
  Plane,
  Route,
  TrendingUp,
  Wrench,
} from "lucide-react";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { JwCard } from "@/components/JwCard";
import { api } from "@/lib/api-client";
import { shortenAirportHeadline } from "@/lib/airport-display-labels";
import { pct, usd, usdAbbrev } from "@/lib/format";
import { iso2ToFlagEmoji, regionNameFromIso2 } from "@/lib/location-labels";
import { MAX_AIRCRAFT_PER_ROUTE } from "@/lib/optimizer";

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

type RouteAirportMeta = {
  icao: string;
  name: string | null;
  city: string | null;
  countryIso2: string | null;
};

type RouteRes = {
  route: {
    id: string;
    origin: string;
    destination: string;
    origin_airport_name?: string | null;
    destination_airport_name?: string | null;
    origin_airport?: RouteAirportMeta | null;
    destination_airport?: RouteAirportMeta | null;
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
      marginal_a350_value?: number;
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

function aircraftVariantLabel(type: string): string {
  if (type === "A380") return "A380-800";
  if (type === "A330") return "A330-800";
  if (type === "A350") return "A350-900ULR";
  return type;
}

function aircraftFullName(type: string): string {
  if (type === "A380") return "Airbus A380-800";
  if (type === "A330") return "Airbus A330-800";
  if (type === "A350") return "Airbus A350-900ULR";
  return type;
}

function aircraftOptimizedMixSummaryName(type: string): string {
  if (type === "A380") return "Airbus A380-800";
  if (type === "A330") return "Airbus A330-800NEO";
  if (type === "A350") return "Airbus A350-900ULR";
  return type;
}

function optimizedMixLineSummary(rows: FleetEconomicsRow[]): string {
  if (!rows.length) return "—";
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.type, (m.get(r.type) ?? 0) + 1);
  const typeRank = (t: string) => (t === "A380" ? 0 : t === "A350" ? 1 : t === "A330" ? 2 : 99);
  const types = [...m.keys()].sort((a, b) => typeRank(a) - typeRank(b) || a.localeCompare(b));
  return types
    .map((t) => `${m.get(t)} x ${aircraftOptimizedMixSummaryName(t)}`)
    .join(" + ");
}

function usdKPerHour(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}k / hr`;
  return `${sign}${usd(abs, { maximumFractionDigits: 0 })} / hr`;
}

function formatHours(n: number): string {
  return `${n.toFixed(2)} h`;
}

function formatWholeNumber(n: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
}

function equipmentLabel(currentRows: FleetEconomicsRow[], optimizedRows: FleetEconomicsRow[]): string {
  const rows = currentRows.length ? currentRows : optimizedRows;
  const types = [...new Set(rows.map((row) => row.type))];
  if (types.length === 0) return "Widebody";
  if (types.length === 1) return aircraftVariantLabel(types[0]);
  return "Mixed widebody";
}

function sumWeeklyCostBreakdown(rows: FleetEconomicsRow[]) {
  return rows.reduce(
    (sum, row) => ({
      fuel: sum.fuel + row.cost_breakdown.fuel * row.trips_per_week,
      co2: sum.co2 + row.cost_breakdown.co2 * row.trips_per_week,
      maintenance: sum.maintenance + (row.cost_breakdown.acheck + row.cost_breakdown.repair) * row.trips_per_week,
    }),
    { fuel: 0, co2: 0, maintenance: 0 }
  );
}

function buildAirportInfo(
  code: string,
  airport: RouteAirportMeta | null | undefined,
  fallbackName: string | null | undefined
) {
  const city = airport?.city?.trim() ?? null;
  const airportName = airport?.name ? shortenAirportHeadline(airport.name) : fallbackName ?? null;
  const countryIso2 = airport?.countryIso2?.trim().toUpperCase() ?? "";
  const country = countryIso2.length === 2 ? regionNameFromIso2(countryIso2) : null;
  const flag = countryIso2.length === 2 ? iso2ToFlagEmoji(countryIso2) : null;
  return {
    code,
    city,
    airportName,
    countryLine: country ? `${flag ? `${flag} ` : ""}${country}` : null,
  };
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
      {children}
    </p>
  );
}

export default function RouteDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = String(params.id);
  const optimizerQs = searchParams.toString();
  const router = useRouter();

  const [data, setData] = useState<RouteRes | null>(null);
  const [allRoutes, setAllRoutes] = useState<RouteListBench[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [costExpanded, setCostExpanded] = useState(true);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const suffix = optimizerQs ? `?${optimizerQs}` : "";
      const j = await api<RouteRes>(`/api/routes/${id}${suffix}`);
      setData(j);
      const list = await api<{ routes: RouteListBench[] }>(`/api/routes${suffix}`);
      setAllRoutes(list.routes ?? []);
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [id, optimizerQs]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  async function remove() {
    if (!confirm("Delete this route?")) return;
    await api(`/api/routes/${id}`, { method: "DELETE" });
    router.push("/routes");
  }

  if (err || !data) {
    return (
      <JwCard title="Route" subtitle={err ? String(err) : "Loading"}>
        {err ? <p className="text-sm text-orange-400">{err}</p> : <p className="text-sm text-zinc-500">…</p>}
      </JwCard>
    );
  }

  const r = data.route;
  const opt = r.optimized;
  const comp = r.comparison;
  const currentRows = r.current.economics_rows ?? [];
  const optimizedRows = opt.fleet_mix ?? [];

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

  const optimizedFlightHoursPerWeek = optimizedRows.reduce(
    (sum, row) => sum + row.flight_time_hours * row.trips_per_week,
    0
  );
  const optimizedProfitPerHour =
    optimizedFlightHoursPerWeek > 0 ? opt.total_profit_per_week / optimizedFlightHoursPerWeek : 0;
  const configLeakPerWeek = (opt.total_profit_per_week ?? 0) - (r.current.weekly_profit_per_week ?? 0);
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

  const originHeadlineRaw =
    r.origin_airport_name != null && r.origin_airport_name !== ""
      ? shortenAirportHeadline(r.origin_airport_name)
      : null;
  const destHeadlineRaw =
    r.destination_airport_name != null && r.destination_airport_name !== ""
      ? shortenAirportHeadline(r.destination_airport_name)
      : null;
  /** Omit subtitles that only repeat the ICAO — saves vertical noise on phones. */
  const originHeadline =
    originHeadlineRaw &&
    originHeadlineRaw.replace(/\s+/g, "").toUpperCase() !== r.origin.replace(/\s+/g, "").toUpperCase()
      ? originHeadlineRaw
      : null;
  const destHeadline =
    destHeadlineRaw &&
    destHeadlineRaw.replace(/\s+/g, "").toUpperCase() !== r.destination.replace(/\s+/g, "").toUpperCase()
      ? destHeadlineRaw
      : null;
  const hubBanner =
    r.hub && r.hub !== r.origin && r.hub !== r.destination ? `Hub ${r.hub}` : null;
  const originInfo = buildAirportInfo(r.origin, r.origin_airport, originHeadline);
  const destinationInfo = buildAirportInfo(r.destination, r.destination_airport, destHeadline);
  const currentCostBreakdown = sumWeeklyCostBreakdown(currentRows);
  const routeMetrics = [
    {
      label: "Distance",
      value: `${formatWholeNumber(Math.round(r.distance))} km`,
      icon: Route,
    },
    {
      label: "Block time",
      value: formatHours(opt.scheduling.flight_time_hours),
      icon: Clock3,
    },
    {
      label: "Frequency",
      value: `${opt.scheduling.trips_per_week} trips/wk`,
      icon: CalendarDays,
    },
    {
      label: "Equipment",
      value: equipmentLabel(currentRows, optimizedRows),
      icon: Plane,
    },
  ] as const;
  const revenueSnapshotRow = {
    label: "Revenue / wk",
    value: usd(currentRevenuePerWeek, { maximumFractionDigits: 0 }),
    icon: BadgeDollarSign,
  };
  const RevenueSnapshotIcon = revenueSnapshotRow.icon;
  const snapshotRows = [
    {
      label: "Profit / wk",
      value: usd(r.current.weekly_profit_per_week ?? 0, { maximumFractionDigits: 0 }),
      icon: TrendingUp,
    },
    {
      label: "Profit / flight-hour",
      value: usd(currentProfitPerHour, { maximumFractionDigits: 0 }),
      icon: Clock3,
    },
  ] as const;

  return (
    <div className="mx-auto max-w-2xl space-y-4 sm:space-y-5">
      <section className="overflow-hidden rounded-[28px] border border-cyan-500/20 bg-[linear-gradient(180deg,rgba(8,19,29,0.97),rgba(5,13,21,0.94))] shadow-[0_20px_70px_-44px_rgba(34,211,238,0.35)] backdrop-blur-xl">
        <div className="bg-[radial-gradient(110%_85%_at_50%_100%,rgba(24,175,182,0.18),transparent_62%)] p-4 sm:p-5">
          <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">
            {hubBanner ?? (r.hub ? `${r.hub} · hub leg` : "Direct route")}
          </p>

          <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-3 sm:items-center sm:gap-5">
            <AirportColumn code={originInfo.code} city={originInfo.city} airportName={originInfo.airportName} countryLine={originInfo.countryLine} />
            <RouteConnector />
            <AirportColumn
              code={destinationInfo.code}
              city={destinationInfo.city}
              airportName={destinationInfo.airportName}
              countryLine={destinationInfo.countryLine}
              align="right"
            />
          </div>

          <BoardingPassDivider />

          <div className="grid grid-cols-4 divide-x divide-cyan-400/10">
            {routeMetrics.map(({ label, value, icon: Icon }) => (
              <div key={label} className="flex min-w-0 flex-col gap-2 px-3 py-1 first:pl-0 last:pr-0">
                <Icon className="h-4 w-4 text-cyan-300/75" aria-hidden strokeWidth={1.8} />
                <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">{label}</p>
                <p className="text-sm font-semibold leading-tight text-zinc-100 sm:text-[15px]">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-cyan-500/14 bg-[linear-gradient(180deg,rgba(7,14,21,0.95),rgba(4,11,18,0.92))] p-4 shadow-[0_18px_60px_-46px_rgba(34,211,238,0.32)] backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-cyan-400/18 bg-cyan-400/[0.08]">
            <Coins className="h-4 w-4 text-cyan-200" aria-hidden strokeWidth={1.8} />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Current assignment snapshot</p>
            <p className="mt-1 text-sm text-zinc-400">Weekly economics for the fleet currently flying this leg.</p>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-cyan-500/10 bg-black/25">
          <SnapshotRow
            label={revenueSnapshotRow.label}
            value={revenueSnapshotRow.value}
            icon={<RevenueSnapshotIcon className="h-4 w-4" aria-hidden strokeWidth={1.8} />}
          />

          <button
            type="button"
            onClick={() => setCostExpanded((open) => !open)}
            className="flex min-h-14 w-full items-center gap-3 border-t border-cyan-400/8 px-4 py-3 text-left"
            aria-expanded={costExpanded}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-cyan-400/16 bg-cyan-400/[0.08] text-cyan-200">
              <Wrench className="h-4 w-4" aria-hidden strokeWidth={1.8} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Cost / wk</p>
            </div>
            <p className="shrink-0 font-mono text-[17px] font-semibold tabular-nums text-zinc-100">
              {usd(currentCostPerWeek, { maximumFractionDigits: 0 })}
            </p>
            {costExpanded ? (
              <ChevronDown className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
            )}
          </button>

          {costExpanded ? (
            <div className="border-t border-cyan-400/8 bg-black/20 px-4 py-2">
              <div className="ml-12 space-y-0.5">
                <CostBreakdownRow label="Fuel" value={usd(currentCostBreakdown.fuel, { maximumFractionDigits: 0 })} />
                <CostBreakdownRow label="CO₂" value={usd(currentCostBreakdown.co2, { maximumFractionDigits: 0 })} />
                <CostBreakdownRow
                  label="Maintenance"
                  value={usd(currentCostBreakdown.maintenance, { maximumFractionDigits: 0 })}
                />
              </div>
            </div>
          ) : null}

          {snapshotRows.map(({ label, value, icon: Icon }) => (
            <SnapshotRow
              key={label}
              label={label}
              value={value}
              icon={<Icon className="h-4 w-4" aria-hidden strokeWidth={1.8} />}
              bordered
            />
          ))}
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <Link
          href={`/routes/new?edit=${r.id}`}
          className="flex min-h-12 items-center justify-center rounded-2xl border border-zinc-700/80 bg-black/20 px-4 py-3 text-sm font-medium text-zinc-200 transition hover:border-zinc-500/80 hover:text-white"
        >
          Edit
        </Link>
        <button
          type="button"
          onClick={() => void remove()}
          className="min-h-12 rounded-2xl border border-orange-500/40 bg-orange-500/[0.03] px-4 py-3 text-sm font-medium text-orange-300 transition hover:border-orange-400/55 hover:bg-orange-500/[0.06]"
        >
          Delete
        </button>
      </div>

      <section className="rounded-[24px] border border-zinc-800/80 bg-black/20 p-4 backdrop-blur-xl">
        <SectionLabel>Optimization opportunity</SectionLabel>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Stat title="Optimized profit / wk" value={usdAbbrev(opt.total_profit_per_week)} />
          <Stat title="Leak vs current / wk" value={usdAbbrev(configLeakPerWeek)} highlight />
          <Stat title="Optimized profit / flight-hour" value={usdAbbrev(optimizedProfitPerHour)} />
          <Stat
            title="Demand fulfilled"
            value={`${pct(comp.current_demand_fulfilled)} → ${pct(comp.optimized_demand_fulfilled)}`}
          />
        </div>
      </section>

      <section className="rounded-[24px] border border-zinc-800/80 bg-black/20 p-4 backdrop-blur-xl">
        <SectionLabel>Route model context</SectionLabel>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Stat title="Current rank" value={currentRankLabel} />
          <Stat title="Optimized rank" value={optimizedRankLabel} />
          <Stat title="Delta vs current" value={usdAbbrev(comp.delta_per_week)} highlight />
          <Stat title="Bracket (~daily eq)" value={String(opt.scheduling.trip_bracket)} />
        </div>
        <dl className="mt-4 grid gap-2 rounded-2xl border border-zinc-800/70 bg-black/20 px-4 py-3 text-[13px] text-zinc-400">
          <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
            <dt className="text-zinc-500">Demand (24h)</dt>
            <dd className="font-mono text-zinc-300">
              Y{r.demand.y} · J{r.demand.j} · F{r.demand.f}
            </dd>
          </div>
          <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 border-t border-zinc-800/60 pt-2">
            <dt className="text-zinc-500">Tickets</dt>
            <dd className="text-right font-mono text-zinc-300">
              Y {usdAbbrev(r.prices.y)} · J {usdAbbrev(r.prices.j)} · F {usdAbbrev(r.prices.f)}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-[24px] border border-zinc-800/80 bg-black/20 p-4 backdrop-blur-xl">
        <SectionLabel>Current assignment lines</SectionLabel>
        <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
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

      <section className="rounded-[24px] border border-zinc-800/80 bg-black/20 p-4 backdrop-blur-xl">
        <SectionLabel>Optimal assignment (modeled)</SectionLabel>
        <p className="mb-3 text-[13px] leading-relaxed text-zinc-400">
          {optimizedMixLineSummary(optimizedRows)} · cap {MAX_AIRCRAFT_PER_ROUTE} hull · marginal A330{" "}
          {usdAbbrev(opt.marginal_a330_value)} · A350 {usdAbbrev(opt.marginal_a350_value ?? 0)} · A380{" "}
          {usdAbbrev(opt.marginal_a380_value)}
        </p>
        <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
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
  );
}

function moneyScan(n: number): string {
  return Math.abs(n) >= 100_000 ? usdAbbrev(n) : usd(n, { maximumFractionDigits: 0 });
}

function AirportColumn({
  code,
  city,
  airportName,
  countryLine,
  align = "left",
}: {
  code: string;
  city: string | null;
  airportName: string | null;
  countryLine: string | null;
  align?: "left" | "right";
}) {
  const alignment = align === "right" ? "items-end text-right" : "items-start text-left";
  return (
    <div className={`flex min-w-0 flex-col gap-1 ${alignment}`}>
      <p className="font-mono text-[2rem] font-semibold leading-none tracking-[0.02em] text-white sm:text-[3rem]">
        {code}
      </p>
      {city ? <p className="text-[15px] font-medium text-cyan-200/90">{city}</p> : null}
      {airportName ? <p className="text-sm leading-snug text-zinc-400">{airportName}</p> : null}
      {countryLine ? <p className="text-sm text-zinc-500">{countryLine}</p> : null}
    </div>
  );
}

function RouteConnector() {
  return (
    <div className="flex min-w-[84px] items-center justify-center gap-2 self-center px-1 sm:min-w-[120px]">
      <div className="h-px flex-1 border-t border-dashed border-cyan-300/35" />
      <div className="flex h-11 w-11 items-center justify-center rounded-full border border-cyan-300/30 bg-black/25 shadow-[0_10px_28px_-18px_rgba(34,211,238,0.85)]">
        <Plane className="h-4 w-4 -rotate-45 text-cyan-100" aria-hidden strokeWidth={1.9} />
      </div>
      <div className="h-px flex-1 border-t border-dashed border-cyan-300/35" />
    </div>
  );
}

function BoardingPassDivider() {
  return (
    <div className="relative my-5 h-6">
      <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 border-t border-dashed border-cyan-300/12" />
      <div className="absolute -left-7 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full border border-cyan-300/10 bg-[#050b12]" />
      <div className="absolute -right-7 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full border border-cyan-300/10 bg-[#050b12]" />
    </div>
  );
}

function SnapshotRow({
  label,
  value,
  icon,
  bordered = false,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  bordered?: boolean;
}) {
  return (
    <div className={`flex min-h-14 items-center gap-3 px-4 py-3 ${bordered ? "border-t border-cyan-400/8" : ""}`}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-cyan-400/16 bg-cyan-400/[0.08] text-cyan-200">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">{label}</p>
      </div>
      <p className="shrink-0 font-mono text-[17px] font-semibold tabular-nums text-zinc-100">{value}</p>
      <ChevronRight className="h-4 w-4 shrink-0 text-zinc-600" aria-hidden />
    </div>
  );
}

function CostBreakdownRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-cyan-400/8 py-2 first:border-0">
      <p className="text-[13px] text-zinc-500">{label}</p>
      <p className="font-mono text-[13px] tabular-nums text-zinc-300">{value}</p>
    </div>
  );
}

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
      ? "rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.04] text-cyan-50"
      : "rounded-2xl border border-zinc-800 bg-black/30 text-zinc-200";
  const bd = row.cost_breakdown;
  return (
    <li className={`${wrap} p-4 font-mono text-xs`}>
      <div className="text-[14px] font-semibold leading-snug text-white/90">{title}</div>
      <div className="mt-0.5 text-[11px] text-zinc-400">{subtitle}</div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-zinc-300">
        <span>
          Y{row.config.y} J{row.config.j} F{row.config.f}
        </span>
        <span className="text-zinc-500">·</span>
        <span>
          {row.trips_per_week} trips/wk · {row.flight_time_hours.toFixed(2)}h · {usdKPerHour(row.profit_per_hour)}
        </span>
      </div>
      <p className="mt-2 text-[11px] text-zinc-500">
        Tickets Y {usdAbbrev(prices.y)} · J {usdAbbrev(prices.j)} · F {usdAbbrev(prices.f)}
      </p>
      <div className="mt-3 space-y-3 border-t border-zinc-800/50 pt-3">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[11px] uppercase tracking-wide text-zinc-500">Gross / trip</span>
          <span className="tabular-nums text-[15px] text-zinc-100">{usdAbbrev(row.revenue_per_flight)}</span>
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[11px] uppercase tracking-wide text-zinc-500">Cost / trip</span>
            <span className="tabular-nums text-[15px] text-zinc-200">{usdAbbrev(row.cost_per_flight)}</span>
          </div>
          <p className="text-[11px] leading-relaxed text-zinc-500">
            Fuel {moneyScan(bd.fuel)} · CO₂ {moneyScan(bd.co2)} · Maint {moneyScan(bd.acheck + bd.repair)}
          </p>
        </div>
        <div className="flex flex-col gap-2 border-t border-zinc-800/50 pt-3">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[11px] uppercase tracking-wide text-zinc-500">Net / trip</span>
            <span className="tabular-nums text-[15px] font-medium text-emerald-200/95">{usdAbbrev(row.profit_per_flight)}</span>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[11px] uppercase tracking-wide text-zinc-500">Net / week</span>
            <span className="tabular-nums text-[15px] font-medium text-emerald-200/95">{usdAbbrev(row.profit_per_week)}</span>
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
  highlight = false,
}: {
  title: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800/80 bg-black/20 px-3 py-3">
      <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-500">{title}</p>
      <p
        className={
          highlight
            ? "mt-1.5 font-mono text-lg tabular-nums leading-none text-cyan-200 sm:text-[17px]"
            : "mt-1.5 font-mono text-lg tabular-nums leading-none text-zinc-100 sm:text-[17px]"
        }
      >
        {value}
      </p>
    </div>
  );
}
