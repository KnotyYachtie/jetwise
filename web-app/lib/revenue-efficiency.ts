/**
 * “Revenue efficiency” = current weekly profit as a share of optimized weekly profit.
 * If optimized ≤ 0, treat as 100% (current is effectively “at or above” the model ceiling).
 */
export function revenueEfficiencyPercent(currentWeekly: number, optimizedWeekly: number): number {
  if (!Number.isFinite(optimizedWeekly) || optimizedWeekly <= 0) return 100;
  const cur = Number.isFinite(currentWeekly) ? currentWeekly : 0;
  const p = (cur / optimizedWeekly) * 100;
  return Math.min(100, Math.max(0, p));
}

/**
 * Smooth stroke color for the efficiency ring: red → orange → green as % increases.
 * Uses HSL for continuous hue (no hard red/orange/green bands).
 */
export function efficiencyRingColor(percent: number): string {
  const p = Math.max(0, Math.min(100, percent));
  const hue = p < 50 ? (p / 50) * 34 : 34 + ((p - 50) / 50) * 118;
  return `hsl(${hue} 88% 52%)`;
}
