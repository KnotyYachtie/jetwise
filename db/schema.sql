-- Jetwise backbone §14 — run once against Vercel Postgres (SQL editor or psql)

CREATE TABLE IF NOT EXISTS company_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  fuel_price DOUBLE PRECISION NOT NULL DEFAULT 500,
  co2_price DOUBLE PRECISION NOT NULL DEFAULT 120,
  fuel_training DOUBLE PRECISION NOT NULL DEFAULT 100,
  co2_training DOUBLE PRECISION NOT NULL DEFAULT 100,
  repair_training DOUBLE PRECISION NOT NULL DEFAULT 100,
  load_factor DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  ci DOUBLE PRECISION NOT NULL DEFAULT 200,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO company_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS routes (
  id TEXT PRIMARY KEY,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  distance DOUBLE PRECISION NOT NULL,
  hub TEXT,
  demand_y INTEGER NOT NULL DEFAULT 0,
  demand_j INTEGER NOT NULL DEFAULT 0,
  demand_f INTEGER NOT NULL DEFAULT 0,
  technical_stop TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS route_assignments (
  id TEXT PRIMARY KEY,
  route_id TEXT NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  aircraft_type TEXT NOT NULL,
  config_y INTEGER NOT NULL,
  config_j INTEGER NOT NULL,
  config_f INTEGER NOT NULL,
  position INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_route_assignments_route ON route_assignments(route_id);

CREATE TABLE IF NOT EXISTS route_optimizations (
  route_id TEXT PRIMARY KEY REFERENCES routes(id) ON DELETE CASCADE,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  result_json JSONB NOT NULL
);

-- Optional: route composer airport search — run db/airport_lookup.sql in Neon when ready.
