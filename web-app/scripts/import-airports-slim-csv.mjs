/**
 * Replace airport_lookup contents from merge_ourairports_csv.py --slim output.
 *
 * Prerequisites:
 *   1. Run db/airport_lookup_geo_migration.sql on Neon (lat/lon columns).
 *   2. POSTGRES_URL or DATABASE_URL in web-app/.env.local
 *
 * Usage (from web-app/):
 *   npm run import-airports-csv -- /path/to/airports_slim.csv
 *
 * This TRUNCATES airport_lookup then bulk-inserts (full replace).
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { parse } from "csv-parse/sync";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env.local") });
dotenv.config({ path: path.join(__dirname, "../.env") });

const BATCH = 500;

/** OurAirports slim output can repeat the same `icao` after normalization; keep one row per ICAO. */
function rowScore(row) {
  let s = 0;
  if (String(row.scheduled_service ?? "").toLowerCase() === "yes") s += 1000;
  const t = String(row.airport_type ?? "");
  if (t === "large_airport") s += 100;
  else if (t === "medium_airport") s += 50;
  else if (t === "small_airport") s += 20;
  else if (t === "heliport" || t === "seaplane_base") s += 5;
  const id = Number.parseInt(String(row.source_id ?? ""), 10);
  if (Number.isFinite(id)) s += id / 1e12;
  return s;
}

function dedupeByIcao(records) {
  const best = new Map();
  for (const row of records) {
    const icao = String(row.icao ?? "").trim().toUpperCase();
    if (!icao || icao.length < 3) continue;
    const prev = best.get(icao);
    if (!prev) {
      best.set(icao, row);
      continue;
    }
    if (rowScore(row) > rowScore(prev)) best.set(icao, row);
  }
  return Array.from(best.values());
}

function num(v) {
  if (v == null || String(v).trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function main() {
  const fileArg = process.argv[2];
  if (!fileArg) {
    console.error("Usage: npm run import-airports-csv -- /path/to/airports_slim.csv");
    process.exit(1);
  }

  const abs = path.resolve(fileArg);
  if (!fs.existsSync(abs)) {
    console.error("File not found:", abs);
    process.exit(1);
  }

  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!url) {
    console.error("Set POSTGRES_URL or DATABASE_URL (e.g. in .env.local).");
    process.exit(1);
  }

  console.log("Parsing CSV…");
  const raw = fs.readFileSync(abs, "utf8");
  const records = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
  });

  const deduped = dedupeByIcao(records);
  if (deduped.length < records.length) {
    console.log(
      `Dropped ${records.length - deduped.length} duplicate ICAO row(s) → ${deduped.length} unique airports.`
    );
  }

  const client = new pg.Client({ connectionString: url });
  await client.connect();

  console.log("Truncating airport_lookup…");
  await client.query("TRUNCATE TABLE airport_lookup");

  let inserted = 0;
  for (let i = 0; i < deduped.length; i += BATCH) {
    const chunk = deduped.slice(i, i + BATCH);
    const values = [];
    const tuples = [];
    let p = 1;

    for (const row of chunk) {
      const icao = String(row.icao ?? "").trim().toUpperCase();
      if (!icao || icao.length < 3) continue;

      const name = String(row.name ?? "").trim() || icao;
      const city = String(row.city ?? "").trim() || null;
      const country = String(row.country_iso2 ?? "").trim().toUpperCase() || null;
      const iataRaw = String(row.iata ?? "").trim().toUpperCase();
      const iata = iataRaw.length >= 2 && iataRaw.length <= 3 ? iataRaw : null;
      const lat = num(row.latitude_deg);
      const lon = num(row.longitude_deg);
      const airportType = String(row.airport_type ?? "").trim() || null;
      const scheduled = String(row.scheduled_service ?? "").trim().toLowerCase() || null;

      values.push(icao, name, city, country, iata, lat, lon, airportType, scheduled);
      tuples.push(`($${p},$${p + 1},$${p + 2},$${p + 3},$${p + 4},$${p + 5},$${p + 6},$${p + 7},$${p + 8})`);
      p += 9;
    }

    if (!tuples.length) continue;

    await client.query(
      `
      INSERT INTO airport_lookup (
        icao, name, city, country, iata, lat, lon, airport_type, scheduled_service
      )
      VALUES ${tuples.join(",")}
      `,
      values
    );
    inserted += tuples.length;
    if (inserted % 5000 === 0) process.stdout.write(`  …${inserted} rows\r`);
  }

  await client.end();
  console.log(`Done. Inserted ${inserted} rows (table replaced).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
