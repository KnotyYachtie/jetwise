/**
 * Rank hub seed CSV rows by optimizeRoute weekly profit, insert top routes as status=suggested,
 * and persist optimizer fleet_mix as route_assignments.
 *
 * Usage (from web-app/): load `.env.local` with Postgres URL.
 *   npx tsx scripts/rank-import-suggestions.ts [path/to/hub_suggestions_seed.csv]
 *
 * Env:
 *   IMPORT_SUGGESTIONS_LIMIT — max rows to insert after global profit sort (default 150)
 */

import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parse } from "csv-parse/sync";
import { config } from "dotenv";
import { sql } from "@vercel/postgres";
import { replaceRouteAssignments } from "@/lib/assignments-sync";
import { getCompany } from "@/lib/company";
import { HUB_ICAOS } from "@/lib/hubs";
import { optimizeRoute } from "@/lib/optimizer";
import type { Demand } from "@/lib/types";

config({ path: join(process.cwd(), ".env.local") });

type SeedRow = {
  origin: string;
  destination: string;
  demand_y: string;
  demand_j: string;
  demand_f: string;
  distance_km: string;
};

function parseSeed(csvPath: string): SeedRow[] {
  const raw = readFileSync(csvPath, "utf8");
  return parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as SeedRow[];
}

async function main() {
  const defaultCsv = join(homedir(), "Downloads", "hub_suggestions_seed.csv");
  const csvPath = process.argv[2] ?? defaultCsv;
  const limit = Math.max(1, Number(process.env.IMPORT_SUGGESTIONS_LIMIT) || 150);

  console.log(`CSV: ${csvPath}`);
  console.log(`IMPORT_SUGGESTIONS_LIMIT: ${limit}`);

  let seeds: SeedRow[];
  try {
    seeds = parseSeed(csvPath);
  } catch (e) {
    console.error("Failed to read/parse CSV:", e);
    process.exit(1);
  }

  console.log(`seed rows: ${seeds.length}`);

  const company = await getCompany();

  type Scored = {
    origin: string;
    destination: string;
    distance: number;
    demand: Demand;
    profit: number;
    opt: ReturnType<typeof optimizeRoute>;
  };

  const scored: Scored[] = [];

  for (const s of seeds) {
    const origin = String(s.origin).toUpperCase();
    const destination = String(s.destination).toUpperCase();
    const distance = Number(s.distance_km);
    const demand: Demand = {
      y: Number.parseInt(s.demand_y, 10) || 0,
      j: Number.parseInt(s.demand_j, 10) || 0,
      f: Number.parseInt(s.demand_f, 10) || 0,
    };

    if (!Number.isFinite(distance) || distance <= 0) {
      console.warn(`skip bad distance ${origin}-${destination}: ${s.distance_km}`);
      continue;
    }

    const opt = optimizeRoute(distance, demand, company);
    if (!opt.fleet_mix.length || opt.total_profit_per_week <= 0) {
      continue;
    }

    scored.push({
      origin,
      destination,
      distance,
      demand,
      profit: opt.total_profit_per_week,
      opt,
    });
  }

  scored.sort((a, b) => b.profit - a.profit);
  const take = scored.slice(0, limit);

  console.log(`ranked profitable candidates: ${scored.length}`);
  console.log(`attempting insert (top ${take.length})`);

  let inserted = 0;
  let skippedDup = 0;

  for (const row of take) {
    const dup =
      await sql`SELECT id FROM routes WHERE origin = ${row.origin} AND destination = ${row.destination} LIMIT 1`;
    if (dup.rows.length > 0) {
      skippedDup += 1;
      continue;
    }

    const id = randomUUID();
    const hub = HUB_ICAOS.has(row.origin) ? row.origin : null;

    await sql`
      INSERT INTO routes (
        id, origin, destination, distance, hub,
        demand_y, demand_j, demand_f, technical_stop, status, notes, updated_at
      ) VALUES (
        ${id},
        ${row.origin},
        ${row.destination},
        ${row.distance},
        ${hub},
        ${row.demand.y},
        ${row.demand.j},
        ${row.demand.f},
        NULL,
        ${"suggested"},
        ${"jetwise: ranked hub pipeline import"},
        NOW()
      )
    `;

    await replaceRouteAssignments(
      id,
      row.opt.fleet_mix.map((r) => ({
        type: r.type === "A330" ? "A330" : "A380",
        config: r.config,
      }))
    );

    inserted += 1;
    console.log(
      `+ ${row.origin}-${row.destination} profit/wk ${Math.round(row.profit)} (${row.opt.fleet_mix.length} hull)`
    );
  }

  console.log(`done: inserted ${inserted}, skipped duplicate OD ${skippedDup}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
