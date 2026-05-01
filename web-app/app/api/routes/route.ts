import { randomUUID } from "crypto";
import { sql } from "@vercel/postgres";
import { type NextRequest, NextResponse } from "next/server";
import { replaceRouteAssignments, type AssignmentInput } from "@/lib/assignments-sync";
import { isValidHub } from "@/lib/hubs";
import { getEnrichedRouteById, getEnrichedRoutes } from "@/lib/routes-data";

export async function GET(req: NextRequest) {
  try {
    const status = req.nextUrl.searchParams.get("status")?.trim();
    let routes = await getEnrichedRoutes();
    if (status) {
      routes = routes.filter((r) => r.status === status);
    } else {
      routes = routes.filter((r) => r.status !== "suggested");
    }
    return NextResponse.json({ routes });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch routes" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      id: bodyId,
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
      assignments,
    } = body as {
      id?: string;
      origin: string;
      destination: string;
      distance: number;
      hub?: string | null;
      demand_y?: number;
      demand_j?: number;
      demand_f?: number;
      technical_stop?: string | null;
      status?: string;
      notes?: string | null;
      assignments?: AssignmentInput[];
    };

    if (!origin || !destination || distance == null) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (hub && !isValidHub(hub)) {
      return NextResponse.json({ error: "Invalid hub ICAO" }, { status: 400 });
    }

    const id = bodyId || randomUUID();
    const dist = Number(distance);

    await sql`
      INSERT INTO routes (
        id, origin, destination, distance, hub,
        demand_y, demand_j, demand_f, technical_stop, status, notes, updated_at
      ) VALUES (
        ${id},
        ${String(origin).toUpperCase()},
        ${String(destination).toUpperCase()},
        ${dist},
        ${hub ? String(hub).toUpperCase() : null},
        ${Number(demand_y) || 0},
        ${Number(demand_j) || 0},
        ${Number(demand_f) || 0},
        ${technical_stop ? String(technical_stop).toUpperCase() : null},
        ${status || "active"},
        ${notes ?? null},
        NOW()
      )
    `;

    if (Array.isArray(assignments)) {
      await replaceRouteAssignments(id, assignments);
    }

    const route = await getEnrichedRouteById(id);
    return NextResponse.json({ success: true, id, route });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Insert failed" }, { status: 500 });
  }
}
