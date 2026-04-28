export type Demand = { y: number; j: number; f: number };

export type CurrentAircraftRow = {
  type: "A380" | "A330";
  config: { y: number; j: number; f: number };
};
