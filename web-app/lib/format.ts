export function usd(n: number, opts?: { maximumFractionDigits?: number }) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: opts?.maximumFractionDigits ?? 0,
  }).format(n);
}

/** Compact dollars for dashboards (e.g. $88.6m). Easier to scan on small screens. */
export function usdAbbrev(n: number): string {
  const sign = n < 0 ? "-" : "";
  const x = Math.abs(n);
  if (x >= 1e9) return `${sign}$${(x / 1e9).toFixed(2)}b`;
  if (x >= 1e6) return `${sign}$${(x / 1e6).toFixed(1)}m`;
  if (x >= 1e5) return `${sign}$${Math.round(x / 1000)}k`;
  return usd(n, { maximumFractionDigits: 0 });
}

export function pct(n: number) {
  return `${n.toFixed(1)}%`;
}
