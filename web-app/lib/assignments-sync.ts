import { randomUUID } from "crypto";
import { sql } from "@vercel/postgres";

export type AssignmentInput =
  | {
      type: "A380" | "A330" | "A350";
      config: { y: number; j: number; f: number };
    }
  | {
      type: "A380" | "A330" | "A350";
      config_y: number;
      config_j: number;
      config_f: number;
    };

function normalize(a: AssignmentInput) {
  const t = a.type === "A330" ? "A330" : a.type === "A350" ? "A350" : "A380";
  if ("config" in a) {
    return {
      type: t,
      y: a.config.y,
      j: a.config.j,
      f: a.config.f,
    };
  }
  return {
    type: t,
    y: a.config_y,
    j: a.config_j,
    f: a.config_f,
  };
}

export async function replaceRouteAssignments(
  routeId: string,
  assignments: AssignmentInput[] | undefined
) {
  await sql`DELETE FROM route_assignments WHERE route_id = ${routeId}`;
  if (!assignments?.length) return;
  let pos = 1;
  for (const raw of assignments) {
    const a = normalize(raw);
    await sql`
      INSERT INTO route_assignments (id, route_id, aircraft_type, config_y, config_j, config_f, position)
      VALUES (${randomUUID()}, ${routeId}, ${a.type}, ${a.y}, ${a.j}, ${a.f}, ${pos})
    `;
    pos += 1;
  }
}
