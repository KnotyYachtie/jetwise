/**
 * JetWise Optimizer (TypeScript Port)
 */

export type Company = {
  fuel_price: number;
  co2_price: number;
  fuel_training: number;
  co2_training: number;
  repair_training: number;
  load: number;
  ci: number;
};

export type Aircraft = {
  name: string;
  capacity: number;
  speed: number;
  fuel: number;
  co2: number;
  check_cost: number;
  maintenance_interval: number;
  purchase_cost: number;
};

export type Demand = {
  y: number;
  j: number;
  f: number;
};

export type Config = {
  y: number;
  j: number;
  f: number;
};

export type OptimizationResult = {
  aircraft: Aircraft;
  config: Config;
  profit: number;
  daily_profit: number;
  tpd: number;
  profit_per_hour: number;
};

export function ticketPrices(distance: number) {
  return {
    y: 1.10 * (0.3 * distance + 150) - 2,
    j: 1.08 * (0.6 * distance + 500) - 2,
    f: 1.06 * (0.9 * distance + 1000) - 2,
  };
}

export function solveConfig(
  aircraft: Aircraft,
  demand: Demand,
  prices: { y: number; j: number; f: number }
): Config {
  let remaining = aircraft.capacity;

  const valueOrder = [
    { cls: "y", val: prices.y / 1 },
    { cls: "j", val: prices.j / 2 },
    { cls: "f", val: prices.f / 3 },
  ].sort((a, b) => b.val - a.val);

  let y = 0,
    j = 0,
    f = 0;

  for (const v of valueOrder) {
    if (v.cls === "y") {
      const fill = Math.min(demand.y, remaining);
      y += fill;
      remaining -= fill;
    } else if (v.cls === "j") {
      const fill = Math.min(demand.j, Math.floor(remaining / 2));
      j += fill;
      remaining -= fill * 2;
    } else {
      const fill = Math.min(demand.f, Math.floor(remaining / 3));
      f += fill;
      remaining -= fill * 3;
    }
  }

  return { y, j, f };
}

export function evaluate(
  aircraft: Aircraft,
  company: Company,
  distance: number,
  config: Config
) {
  const { y, j, f } = config;
  const prices = ticketPrices(distance);

  const revenue = y * prices.y + j * prices.j + f * prices.f;

  const speedEff = aircraft.speed * (0.0035 * company.ci + 0.3);
  const flightTime = distance / speedEff;

  const fuel =
    (1 - company.fuel_training / 100) *
    distance *
    aircraft.fuel *
    (company.ci / 500 + 0.6);

  const capUnits = y + 2 * j + 3 * f;
  const seats = y + j + f;

  const co2 =
    (1 - company.co2_training / 100) *
    (distance * aircraft.co2 * capUnits * company.load + seats) *
    (company.ci / 2000 + 0.9);

  const acheck =
    aircraft.check_cost *
    Math.ceil(flightTime) /
    aircraft.maintenance_interval;

  const repair =
    aircraft.purchase_cost *
    0.0075 *
    (1 - (2 * company.repair_training) / 100);

  const cost =
    (fuel * company.fuel_price) / 1000 +
    (co2 * company.co2_price) / 1000 +
    acheck +
    repair;

  const profit = revenue - cost;
  const tpd = Math.floor(24 / flightTime);
  const profit_per_hour = profit / flightTime;

  return {
    profit,
    daily_profit: profit * tpd,
    tpd,
    profit_per_hour,
  };
}

export function optimize(
  distance: number,
  demand: Demand,
  aircraftList: Aircraft[],
  company: Company
): OptimizationResult[] {
  const remaining: Demand = { ...demand };
  const plan: OptimizationResult[] = [];

  while (true) {
    let best: (OptimizationResult & { score: number }) | null = null;

    for (const ac of aircraftList) {
      const prices = ticketPrices(distance);
      const config = solveConfig(ac, remaining, prices);
      const result = evaluate(ac, company, distance, config);

      const capUnits = config.y + 2 * config.j + 3 * config.f;
      if (capUnits === 0) continue;

      const score = result.profit / capUnits;

      if (!best || score > best.score) {
        best = {
          aircraft: ac,
          config,
          ...result,
          score,
        };
      }
    }

    if (!best || best.profit <= 0) break;

    plan.push(best);

    remaining.y = Math.max(0, remaining.y - best.config.y);
    remaining.j = Math.max(0, remaining.j - best.config.j);
    remaining.f = Math.max(0, remaining.f - best.config.f);

    if (remaining.y === 0 && remaining.j === 0 && remaining.f === 0) break;
  }

  return plan;
}