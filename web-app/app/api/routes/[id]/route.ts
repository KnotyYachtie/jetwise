import { sql } from "@vercel/postgres";
import { NextRequest, NextResponse } from "next/server";

// GET single route with assignments
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const routeRes = await sql`SELECT * FROM routes WHERE id = ${id}`;
    if (routeRes.rows.length === 0) {
      return NextResponse.json({ error: "Route not found" }, { status: 404 });
    }

    const assignmentsRes = await sql`
      SELECT * FROM route_assignments
      WHERE route_id = ${id}
      ORDER BY position ASC
    `;

    const aircraft = assignmentsRes.rows.map((a: any) => ({
      type: a.aircraft_type,
      config: {
        y: a.config_y,
        j: a.config_j,
        f: a.config_f,
      },
    }));

    const route = {
      ...routeRes.rows[0],
      current: {
        aircraft,
      },
    };

    return NextResponse.json({ route });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch route" }, { status: 500 });
  }
}

// PUT update route fields
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
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
      status,
      notes,
    } = body;

    await sql`
      UPDATE routes SET
        origin = COALESCE(${origin}, origin),
        destination = COALESCE(${destination}, destination),
        distance = COALESCE(${distance}, distance),
        hub = COALESCE(${hub}, hub),
        demand_y = COALESCE(${demand_y}, demand_y),
        demand_j = COALESCE(${demand_j}, demand_j),
        demand_f = COALESCE(${demand_f}, demand_f),
        technical_stop = COALESCE(${technical_stop}, technical_stop),
        status = COALESCE(${status}, status),
        notes = COALESCE(${notes}, notes),
        updated_at = NOW()
      WHERE id = ${id}
    `;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

// DELETE route + its assignments
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    // delete assignments first (if no ON DELETE CASCADE)
    await sql`DELETE FROM route_assignments WHERE route_id = ${id}`;

    await sql`DELETE FROM routes WHERE id = ${id}`;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
