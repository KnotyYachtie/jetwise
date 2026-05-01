/** Route O&D passengers per 24h period (matches demand_y / demand_j / demand_f in DB). */
export type Demand = { y: number; j: number; f: number };

export type CurrentAircraftRow = {
  type: "A380" | "A330";
  config: { y: number; j: number; f: number };
};
