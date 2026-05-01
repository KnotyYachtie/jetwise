import type { Aircraft } from "./economics";

/** Backbone §2 — two types only. Short codes: A380 | A330 */
export const A380_SPEC: Aircraft = {
  shortCode: "A380",
  name: "Airbus A380-800",
  capacity: 600,
  range_km: 14500,
  speed: 1049,
  fuel: 22.26,
  co2: 0.16,
  check_cost: 12_937_770,
  maintenance_interval: 450,
  purchase_cost: 215_629_503,
};

export const A330_SPEC: Aircraft = {
  shortCode: "A330",
  name: "Airbus A330-800 NEO",
  capacity: 406,
  range_km: 13900,
  speed: 801,
  fuel: 12.0,
  co2: 0.15,
  check_cost: 3_423_028,
  maintenance_interval: 510,
  purchase_cost: 85_235_684,
};

export const A350_SPEC: Aircraft = {
  shortCode: "A350",
  name: "Airbus A350-900 ULR",
  capacity: 300,
  range_km: 18000,
  speed: 848,
  fuel: 13.16,
  co2: 0.18,
  check_cost: 3_908_642,
  maintenance_interval: 350,
  purchase_cost: 91_723_576,
};

export type AircraftCode = "A380" | "A330" | "A350";

export const FLEET_TYPES: Aircraft[] = [A380_SPEC, A330_SPEC, A350_SPEC];

export function getAircraftByCode(code: string): Aircraft | undefined {
  return FLEET_TYPES.find((a) => a.shortCode === code);
}
