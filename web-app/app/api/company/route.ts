import { sql } from "@vercel/postgres";
import { NextResponse } from "next/server";
import { DEFAULT_COMPANY, getCompany, rowToCompany } from "@/lib/company";
import type { Company } from "@/lib/economics";

export async function GET() {
  try {
    const company = await getCompany();
    return NextResponse.json({ company });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ company: DEFAULT_COMPANY });
  }
}

export async function PUT(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Partial<Company> & {
      load_factor?: number;
    };
    const cur = await getCompany();
    const next = {
      fuel_price: body.fuel_price ?? cur.fuel_price,
      co2_price: body.co2_price ?? cur.co2_price,
      fuel_training: body.fuel_training ?? cur.fuel_training,
      co2_training: body.co2_training ?? cur.co2_training,
      repair_training: body.repair_training ?? cur.repair_training,
      load_factor: body.load ?? body.load_factor ?? cur.load,
      ci: body.ci ?? cur.ci,
    };

    await sql`
      INSERT INTO company_settings (
        id, fuel_price, co2_price, fuel_training, co2_training,
        repair_training, load_factor, ci, updated_at
      ) VALUES (
        1, ${next.fuel_price}, ${next.co2_price}, ${next.fuel_training}, ${next.co2_training},
        ${next.repair_training}, ${next.load_factor}, ${next.ci}, NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        fuel_price = EXCLUDED.fuel_price,
        co2_price = EXCLUDED.co2_price,
        fuel_training = EXCLUDED.fuel_training,
        co2_training = EXCLUDED.co2_training,
        repair_training = EXCLUDED.repair_training,
        load_factor = EXCLUDED.load_factor,
        ci = EXCLUDED.ci,
        updated_at = NOW()
    `;

    const res = await sql`SELECT * FROM company_settings WHERE id = 1`;
    const row = res.rows[0];
    if (!row) return NextResponse.json({ company: { ...next, load: next.load_factor, load_factor: undefined } as unknown as Company });
    return NextResponse.json({
      company: rowToCompany({
        ...row,
        load_factor: (row as { load_factor: number }).load_factor,
      } as Parameters<typeof rowToCompany>[0]),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
