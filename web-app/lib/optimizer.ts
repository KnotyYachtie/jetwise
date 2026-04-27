// --- Types ---
export type Demand = {
  y: number;
  j: number;
  f: number;
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

export type Company = {
  fuel_price: number;
  co2_price: number;
  fuel_training: number;
  co2_training: number;
  repair_training: number;
  load: number;
  ci: number;
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
  profit_per_week: number;
  trips_per_week: number;
  tpd: number;
  profit_per_hour: number;
};

// --- Placeholder implementations (ensure these exist elsewhere later) ---
function ticketPrices(distance: number) {
  return { y: 1, j: 2, f: 3 };
}

function solveConfig(ac: Aircraft, demand: Demand, prices: any): Config {
  return { y: demand.y, j: demand.j, f: demand.f };
}

function evaluate(ac: Aircraft, company: Company, distance: number, config: Config) {
  const profit = 1000;
  return {
    profit,
    daily_profit: profit,
    profit_per_week: profit * 7,
    trips_per_week: 7,
    tpd: 1,
    profit_per_hour: profit / 10,
  };
}

export function optimize(
  distance: number,
  demand: Demand,
  aircraftList: Aircraft[],
  company: Company
): {
  plan: OptimizationResult[];
  total_profit_per_week: number;
  marginal_values: { aircraft: string; value: number }[];
} {
  // generate all combinations up to 4 aircraft (including mixed + order permutations)
  function generateCombos(aircraftList: Aircraft[], maxLen: number): Aircraft[][] {
    const results: Aircraft[][] = [];

    function build(current: Aircraft[]) {
      if (current.length > 0) {
        results.push([...current]);
      }

      if (current.length === maxLen) return;

      for (const ac of aircraftList) {
        current.push(ac);
        build(current);
        current.pop();
      }
    }

    build([]);
    return results;
  }

  const combos: Aircraft[][] = generateCombos(aircraftList, 4);

  let bestPlan: OptimizationResult[] = [];
  let bestProfit = -Infinity;

  for (const combo of combos) {
    const remaining: Demand = { ...demand };
    const plan: OptimizationResult[] = [];

    for (const ac of combo) {
      const prices = ticketPrices(distance);
      const config = solveConfig(ac, remaining, prices);
      const result = evaluate(ac, company, distance, config);

      const capUnits = config.y + 2 * config.j + 3 * config.f;
      if (capUnits === 0 || result.profit <= 0) continue;

      plan.push({
        aircraft: ac,
        config,
        ...result,
      });

      // reduce demand
      remaining.y = Math.max(0, remaining.y - config.y);
      remaining.j = Math.max(0, remaining.j - config.j);
      remaining.f = Math.max(0, remaining.f - config.f);

      if (remaining.y === 0 && remaining.j === 0 && remaining.f === 0) break;
    }

    const totalProfit = plan.reduce((sum, p) => sum + p.profit_per_week, 0);

    if (totalProfit > bestProfit) {
      bestProfit = totalProfit;
      bestPlan = plan;
    }
  }

  // compute marginal values (value of adding one more aircraft)
  const marginal_values = aircraftList.map((ac) => {
    const extendedCombo = [...bestPlan.map((p) => p.aircraft), ac];

    const remaining: Demand = { ...demand };
    let total = 0;

    for (const aircraft of extendedCombo) {
      const prices = ticketPrices(distance);
      const config = solveConfig(aircraft, remaining, prices);
      const result = evaluate(aircraft, company, distance, config);

      const capUnits = config.y + 2 * config.j + 3 * config.f;
      if (capUnits === 0 || result.profit <= 0) continue;

      total += result.profit_per_week;

      remaining.y = Math.max(0, remaining.y - config.y);
      remaining.j = Math.max(0, remaining.j - config.j);
      remaining.f = Math.max(0, remaining.f - config.f);

      if (remaining.y === 0 && remaining.j === 0 && remaining.f === 0) break;
    }

    return {
      aircraft: ac.name,
      value: total - bestProfit,
    };
  });

  return {
    plan: bestPlan,
    total_profit_per_week: bestProfit,
    marginal_values,
  };
}