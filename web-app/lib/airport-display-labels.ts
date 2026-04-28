/** Drop trailing “Airport” for shorter headlines (hub strings often include it). */
export function shortenAirportHeadline(name: string): string {
  return name.replace(/\s+Airport$/i, "").trim();
}
