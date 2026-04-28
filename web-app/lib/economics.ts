import type { Demand } from "./types";

/** Backbone-aligned aircraft (extends legacy optimizer shape) */
export type Aircraft = {
  shortCode: string;
  name: string;
  capacity: number;
  range_km: number;
  speed: number;
  fuel: number;
  co2: number;
  check_cost: number;
  maintenance_interval: number;
  purchase_cost: number;
};

export type Company = {
  fuel_price: number;
  co2_price: number;
  fuel_training: number;
  co2_training: number;
  repair_training: number;
  load: number;
  ci: number;
};

export type TicketPrices = { y: number; j: number; f: number };

export const MINUTES_PER_WEEK = 10_080;

/** Backbone §5 — REALISM, per seat one-way */
export function ticketPrices(distance: number): TicketPrices {
  return {
    y: 1.1 * (0.3 * distance + 150) - 2,
    j: 1.08 * (0.6 * distance + 500) - 2,
    f: 1.06 * (0.9 * distance + 1000) - 2,
  };
}

export function effectiveSpeed(aircraft: Aircraft, company: Company): number {
  return aircraft.speed * (0.0035 * company.ci + 0.3);
}

export function flightTimeHours(distance: number, aircraft: Aircraft, company: Company): number {
  const v = effectiveSpeed(aircraft, company);
  return distance / v;
}

export function tripsPerWeek(flightTimeHours: number): number {
  const flightTimeMinutes = flightTimeHours * 60;
  if (flightTimeMinutes <= 0) return 0;
  return Math.floor(MINUTES_PER_WEEK / flightTimeMinutes);
}

export type SchedulingInfo = {
  flight_time_hours: number;
  trips_per_week: number;
  trip_bracket: number;
  threshold_proximity_minutes: number;
};

export function schedulingAnalysis(
  flightTimeHours: number,
  tripsPerWeekVal: number
): SchedulingInfo {
  const flight_time_minutes = flightTimeHours * 60;
  const trips_per_day_equivalent = tripsPerWeekVal / 7;
  const bracket = Math.max(
    1,
    Math.min(24, Math.round(trips_per_day_equivalent) || 1)
  );
  const threshold_proximity_minutes =
    flight_time_minutes > 0
      ? Math.floor(MINUTES_PER_WEEK / (bracket + 1)) - flight_time_minutes
      : 0;

  return {
    flight_time_hours: flightTimeHours,
    trips_per_week: tripsPerWeekVal,
    trip_bracket: bracket,
    threshold_proximity_minutes,
  };
}

export type Config = { y: number; j: number; f: number };

/**
 * Backbone §6 — greedy by revenue per capacity unit (Y/1, J/2, F/3).
 */
export function solveConfig(aircraft: Aircraft, demand: Demand, prices: TicketPrices): Config {
  const cap = aircraft.capacity;
  const order = (
    [
      { key: "f" as const, w: 3, price: prices.f, rem: demand.f },
      { key: "j" as const, w: 2, price: prices.j, rem: demand.j },
      { key: "y" as const, w: 1, price: prices.y, rem: demand.y },
    ] as const
  )
    .slice()
    .sort((a, b) => b.price / b.w - a.price / a.w);

  let y = 0,
    j = 0,
    f = 0;
  let used = 0;

  for (const o of order) {
    const maxByCap = Math.floor((cap - used) / o.w);
    const add = Math.max(0, Math.min(o.rem, maxByCap));
    if (o.key === "f") f = add;
    if (o.key === "j") j = add;
    if (o.key === "y") y = add;
    used += add * o.w;
  }

  return { y, j, f };
}

export function capUnits(c: Config): number {
  return c.y + 2 * c.j + 3 * c.f;
}

export function seats(c: Config): number {
  return c.y + c.j + c.f;
}

/** Slider 0–100; fuel/co₂ training scale modest fleet-wide efficiency gains (see constants below). */
function clampPct(x: number): number {
  return Math.min(100, Math.max(0, x));
}

/** At 100% fuel training, modeled fuel consumption is reduced by this fraction vs 0% training. */
const FUEL_TRAINING_MAX_REDUCTION = 0.03;
/** At 100% CO₂ training, modeled CO₂ emissions are reduced by this fraction vs 0% training. */
const CO2_TRAINING_MAX_REDUCTION = 0.05;

export function totalCostPerFlight(
  aircraft: Aircraft,
  company: Company,
  distance: number,
  config: Config,
  flightTimeHours: number
): { fuel: number; co2: number; acheck: number; repair: number; total: number } {
  const ft = clampPct(company.fuel_training);
  const ct = clampPct(company.co2_training);
  const rt = clampPct(company.repair_training);

  const fuel_use_mult = 1 - (ft / 100) * FUEL_TRAINING_MAX_REDUCTION;
  const fuel_lbs =
    fuel_use_mult * distance * aircraft.fuel * (company.ci / 500 + 0.6);
  const fuel_cost = Math.max(0, (fuel_lbs * company.fuel_price) / 1000);

  const cap = capUnits(config);
  const s = seats(config);
  const co2_emit_mult = 1 - (ct / 100) * CO2_TRAINING_MAX_REDUCTION;
  const co2_units =
    co2_emit_mult *
    (distance * aircraft.co2 * cap * company.load + s) *
    (company.ci / 2000 + 0.9);
  const co2_cost = Math.max(0, (co2_units * company.co2_price) / 1000);

  const acheck = Math.max(
    0,
    (aircraft.check_cost * Math.ceil(flightTimeHours)) / aircraft.maintenance_interval
  );

  const repair_mult = Math.max(0, 1 - (2 * rt) / 100);
  const repair = Math.max(0, aircraft.purchase_cost * 0.0075 * repair_mult);

  const total = fuel_cost + co2_cost + acheck + repair;
  return { fuel: fuel_cost, co2: co2_cost, acheck, repair, total };
}

export function revenuePerFlight(config: Config, prices: TicketPrices): number {
  return config.y * prices.y + config.j * prices.j + config.f * prices.f;
}

export type FlightEconomics = {
  config: Config;
  prices: TicketPrices;
  revenue_per_flight: number;
  profit_per_flight: number;
  trips_per_week: number;
  profit_per_week: number;
  daily_asset_yield: number;
  scheduling: SchedulingInfo;
  cost_breakdown: ReturnType<typeof totalCostPerFlight>;
};

function buildFlightEconomics(
  aircraft: Aircraft,
  company: Company,
  distance: number,
  config: Config,
  prices: TicketPrices
): FlightEconomics | null {
  if (capUnits(config) === 0) return null;

  const ft = flightTimeHours(distance, aircraft, company);
  const tpw = tripsPerWeek(ft);
  if (tpw <= 0) return null;

  const costs = totalCostPerFlight(aircraft, company, distance, config, ft);
  const revenue = revenuePerFlight(config, prices);
  const profit_per_flight = revenue - costs.total;

  return {
    config,
    prices,
    revenue_per_flight: revenue,
    profit_per_flight,
    trips_per_week: tpw,
    profit_per_week: profit_per_flight * tpw,
    daily_asset_yield: (profit_per_flight * tpw) / 7,
    scheduling: schedulingAnalysis(ft, tpw),
    cost_breakdown: costs,
  };
}

export function evaluateAircraftOnRoute(
  aircraft: Aircraft,
  company: Company,
  distance: number,
  demand: Demand
): FlightEconomics | null {
  if (distance > aircraft.range_km) return null;
  const prices = ticketPrices(distance);
  const config = solveConfig(aircraft, demand, prices);
  return buildFlightEconomics(aircraft, company, distance, config, prices);
}

/** Current assignment uses operator-chosen configs (not re-optimized). */
export function evaluateWithFixedConfig(
  aircraft: Aircraft,
  company: Company,
  distance: number,
  config: Config
): FlightEconomics | null {
  if (distance > aircraft.range_km) return null;
  const prices = ticketPrices(distance);
  return buildFlightEconomics(aircraft, company, distance, config, prices);
}

export function demandFulfilledPercent(demand: Demand, served: { y: number; j: number; f: number }): number {
  const d = demand.y + demand.j + demand.f;
  if (d === 0) return 100;
  const s =
    Math.min(served.y, demand.y) + Math.min(served.j, demand.j) + Math.min(served.f, demand.f);
  return (s / d) * 100;
}
