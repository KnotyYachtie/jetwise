

import { sql } from "@vercel/postgres";
import { NextResponse } from "next/server";

// GET all routes with assignments
export async function GET() {
  try {
    const routesRes = await sql`SELECT * FROM routes ORDER BY id DESC`;
    const assignmentsRes = await sql`SELECT * FROM route_assignments`;

    const routes = routesRes.rows.map((route: any) => {
      const aircraft = assignmentsRes.rows
        .filter((a: any) => a.route_id === route.id)
        .sort((a: any, b: any) => a.position - b.position)
        .map((a: any) => ({
          type: a.aircraft_type,
          config: {
            y: a.config_y,
            j: a.config_j,
            f: a.config_f,
          },
        }));

      return {
        ...route,
        current: {
          aircraft,
        },
      };
    });

    return NextResponse.json({ routes });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch routes" }, { status: 500 });
  }
}

// POST create new route
export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      origin,
      destination,
      distance,
      hub,
      demand_y,
      demand_j,
      demand_f,
      technical_stop,
    } = body;

    if (!origin || !destination || !distance) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const result = await sql`
      INSERT INTO routes (origin, destination, distance, hub, demand_y, demand_j, demand_f, technical_stop)
      VALUES (${origin}, ${destination}, ${distance}, ${hub || null}, ${demand_y || 0}, ${demand_j || 0}, ${demand_f || 0}, ${technical_stop || null})
      RETURNING id
    `;

    return NextResponse.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Insert failed" }, { status: 500 });
  }
}