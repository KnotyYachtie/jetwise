export type HubInfo = { icao: string; name: string; city: string; country: string };

/** Backbone §3 */
export const HUBS: HubInfo[] = [
  { icao: "KMIA", name: "Miami International Airport", city: "Miami, FL", country: "US" },
  { icao: "KSPG", name: "St. Pete–Clearwater International", city: "St. Pete, FL", country: "US" },
  { icao: "KFLL", name: "Fort Lauderdale–Hollywood International", city: "Fort Lauderdale, FL", country: "US" },
  { icao: "KJFK", name: "John F. Kennedy International", city: "New York, NY", country: "US" },
  { icao: "YMML", name: "Melbourne Airport", city: "Melbourne", country: "AU" },
  { icao: "EDDF", name: "Frankfurt Airport", city: "Frankfurt", country: "DE" },
  { icao: "OMDB", name: "Dubai International Airport", city: "Dubai", country: "AE" },
];

export const HUB_ICAOS = new Set(HUBS.map((h) => h.icao));

export function isValidHub(icao: string | null | undefined): boolean {
  if (!icao) return false;
  return HUB_ICAOS.has(icao.toUpperCase());
}
