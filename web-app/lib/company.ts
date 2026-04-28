import { sql } from "@vercel/postgres";
import type { Company } from "./economics";

export const DEFAULT_COMPANY: Company = {
  fuel_price: 500,
  co2_price: 120,
  fuel_training: 100,
  co2_training: 100,
  repair_training: 100,
  load: 1.0,
  ci: 200,
};

export function rowToCompany(r: {
  fuel_price: number;
  co2_price: number;
  fuel_training: number;
  co2_training: number;
  repair_training: number;
  load_factor: number;
  ci: number;
}): Company {
  return {
    fuel_price: r.fuel_price,
    co2_price: r.co2_price,
    fuel_training: r.fuel_training,
    co2_training: r.co2_training,
    repair_training: r.repair_training,
    load: r.load_factor,
    ci: r.ci,
  };
}

export async function getCompany(): Promise<Company> {
  const res = await sql`SELECT * FROM company_settings WHERE id = 1`;
  if (res.rows.length === 0) return { ...DEFAULT_COMPANY };
  return rowToCompany(res.rows[0] as Parameters<typeof rowToCompany>[0]);
}
