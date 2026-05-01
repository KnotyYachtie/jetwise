/**
 * Jetwise UI tokens mirrored in `app/globals.css` (`--jw-*`, `--jw-globe-*`).
 * Use these in TS when CSS variables are unavailable (SSR, Canvas, etc.).
 */
export const JW_TOKENS = {
  accent: "#22d3ee",
  bg: "#000000",
  warn: "#fb923c",
  globe: {
    /** Sphere base albedo */
    base: "#040c12",
    /** Emissive tint (cyan-teal) */
    emissive: "#062a32",
    emissiveIntensity: 0.55,
    roughness: 0.42,
    metalness: 0.12,
    atmosphere: "rgba(34, 211, 238, 0.28)",
    atmosphereAltitude: 0.18,
    arc: "#22d3ee",
    /** Scene fog (matches app bg) */
    fog: "#000000",
    ambient: "#1a1a1e",
    directional: "#e4e4e7",
  },
} as const;
