export function usd(n: number, opts?: { maximumFractionDigits?: number }) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: opts?.maximumFractionDigits ?? 0,
  }).format(n);
}

export function pct(n: number) {
  return `${n.toFixed(1)}%`;
}
