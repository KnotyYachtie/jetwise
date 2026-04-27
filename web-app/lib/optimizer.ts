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