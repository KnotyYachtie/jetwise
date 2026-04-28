/** ISO 3166-1 alpha-2 → regional-indicator flag emoji */
export function iso2ToFlagEmoji(iso2: string): string {
  const c = iso2.trim().toUpperCase();
  if (c.length !== 2) return "🌐";
  const u0 = c.codePointAt(0);
  const u1 = c.codePointAt(1);
  if (u0 === undefined || u1 === undefined) return "🌐";
  const a = 0x1f1e6 + (u0 - 0x41);
  const b = 0x1f1e6 + (u1 - 0x41);
  if (a < 0x1f1e6 || a > 0x1f1ff || b < 0x1f1e6 || b > 0x1f1ff) return "🌐";
  return String.fromCodePoint(a, b);
}

let regionNames: Intl.DisplayNames | null = null;
function getRegionNames(): Intl.DisplayNames | null {
  if (typeof Intl === "undefined" || !("DisplayNames" in Intl)) return null;
  if (!regionNames) {
    try {
      regionNames = new Intl.DisplayNames(["en"], { type: "region" });
    } catch {
      return null;
    }
  }
  return regionNames;
}

export function regionNameFromIso2(iso2: string): string {
  const c = iso2.trim().toUpperCase();
  if (c.length !== 2) return iso2;
  try {
    return getRegionNames()?.of(c) ?? c;
  } catch {
    return c;
  }
}

/**
 * e.g. `🇺🇸 KMIA · Miami International Airport · Miami, FL · United States`
 * (flag · ICAO · name · city · country name)
 */
export function formatAirportLine(input: {
  icao: string;
  name: string;
  countryIso2: string;
  city?: string | null;
}): string {
  const flag = iso2ToFlagEmoji(input.countryIso2);
  const country = regionNameFromIso2(input.countryIso2);
  const city = input.city?.trim();
  if (city) {
    return `${flag} ${input.icao} · ${input.name} · ${city} · ${country}`;
  }
  return `${flag} ${input.icao} · ${input.name} · ${country}`;
}
