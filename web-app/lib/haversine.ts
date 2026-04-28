/** Earth radius km (mean spherical approximation). */
const R_KM = 6371;

function toRad(d: number): number {
  return (d * Math.PI) / 180;
}

/** Great-circle distance between two WGS84 points (degrees in, km out). */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lon2 - lon1);

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  return R_KM * c;
}
