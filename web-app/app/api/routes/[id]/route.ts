import { sql } from "@vercel/postgres";
import { NextRequest, NextResponse } from "next/server";
import { replaceRouteAssignments, type AssignmentInput } from "@/lib/assignments-sync";
import { isValidHub } from "@/lib/hubs";
import { optionsFromSearchParams } from "@/lib/optimizer-options";
import { getEnrichedRouteById } from "@/lib/routes-data";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const route = await getEnrichedRouteById(id, optionsFromSearchParams(_req.nextUrl.searchParams));
    if (!route) {
      return NextResponse.json({ error: "Route not found" }, { status: 404 });
    }
    return NextResponse.json({ route });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch route" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = (await req.json()) as {
      origin?: string;
      destination?: string;
      distance?: number;
      hub?: string | null;
      demand_y?: number;
      demand_j?: number;
      demand_f?: number;
      technical_stop?: string | null;
      status?: string;
      notes?: string | null;
      assignments?: AssignmentInput[];
    };

    if (body.hub && !isValidHub(body.hub)) {
      return NextResponse.json({ error: "Invalid hub ICAO" }, { status: 400 });
    }

    const cur = await sql`SELECT * FROM routes WHERE id = ${id}`;
    if (cur.rows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const r = cur.rows[0] as Record<string, unknown>;

    await sql`
      UPDATE routes SET
        origin = ${(body.origin ?? r.origin) as string},
        destination = ${(body.destination ?? r.destination) as string},
        distance = ${Number(body.distance ?? r.distance)},
        hub = ${body.hub !== undefined ? (body.hub ? String(body.hub).toUpperCase() : null) : (r.hub as string | null)},
        demand_y = ${Number(body.demand_y ?? r.demand_y)},
        demand_j = ${Number(body.demand_j ?? r.demand_j)},
        demand_f = ${Number(body.demand_f ?? r.demand_f)},
        technical_stop = ${body.technical_stop !== undefined ? (body.technical_stop ? String(body.technical_stop).toUpperCase() : null) : (r.technical_stop as string | null)},
        status = ${(body.status ?? r.status) as string},
        notes = ${body.notes !== undefined ? body.notes : (r.notes as string | null)},
        updated_at = NOW()
      WHERE id = ${id}
    `;

    if (body.assignments !== undefined) {
      await replaceRouteAssignments(id, body.assignments);
    }

    const route = await getEnrichedRouteById(id);
    return NextResponse.json({ success: true, route });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    await sql`DELETE FROM route_assignments WHERE route_id = ${id}`;
    await sql`DELETE FROM routes WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
