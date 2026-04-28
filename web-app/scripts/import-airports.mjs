/**
 * Bulk load airports from OurAirports-style JSON (object keyed by ICAO).
 *
 * Prerequisites:
 *   1. Run db/airport_lookup.sql and db/airport_lookup_iata_migration.sql on Neon (or use merged schema with `iata`).
 *   2. POSTGRES_URL or DATABASE_URL in .env.local (same as Vercel / Neon pooled URL).
 *
 * Usage (from web-app/):
 *   npm run import-airports -- /path/to/airports.json
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env.local") });
dotenv.config({ path: path.join(__dirname, "../.env") });

const BATCH = 400;

function displayCity(row) {
  const city = (row.city ?? "").trim();
  const state = (row.state ?? "").trim();
  if (city && state) return `${city}, ${state}`;
  return city || state || null;
}

function normalizeIata(row) {
  const t = (row.iata ?? "").trim().toUpperCase();
  return t.length >= 2 && t.length <= 3 ? t : null;
}

async function main() {
  const fileArg = process.argv[2];
  if (!fileArg) {
    console.error("Usage: npm run import-airports -- /path/to/airports.json");
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

  console.log("Reading JSON (may take a few seconds)…");
  const raw = JSON.parse(fs.readFileSync(abs, "utf8"));
  const rows = Object.values(raw);
  console.log("Rows:", rows.length);

  const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();

  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const values = [];
    const tupleSql = [];
    let p = 1;
    for (const a of chunk) {
      const icao = (a.icao ?? "").trim().toUpperCase();
      if (icao.length < 3) continue;
      const name = (a.name ?? "").trim() || icao;
      const country = (a.country ?? "").trim().toUpperCase() || null;
      const city = displayCity(a);
      const iata = normalizeIata(a);
      values.push(icao, name, city, country, iata);
      tupleSql.push(`($${p},$${p + 1},$${p + 2},$${p + 3},$${p + 4})`);
      p += 5;
    }

    if (!tupleSql.length) continue;

    const text = `
      INSERT INTO airport_lookup (icao, name, city, country, iata)
      VALUES ${tupleSql.join(",")}
      ON CONFLICT (icao) DO UPDATE SET
        name = EXCLUDED.name,
        city = EXCLUDED.city,
        country = EXCLUDED.country,
        iata = EXCLUDED.iata
    `;
    await client.query(text, values);
    inserted += tupleSql.length;
    if (inserted % 5000 === 0) {
      process.stdout.write(`  …${inserted} rows\r`);
    }
  }

  await client.end();
  console.log("Done. Upserted ~", inserted, "rows.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
