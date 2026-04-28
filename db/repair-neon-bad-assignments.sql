-- Jetwise: fix Neon INTEGER columns on route_assignments (app expects TEXT UUIDs).
--
-- STEP 1 — In Neon, run this to see what you have:
--   SELECT table_name, column_name, data_type
--   FROM information_schema.columns
--   WHERE table_schema = 'public'
--     AND table_name IN ('routes', 'route_assignments', 'route_optimizations')
--     AND column_name IN ('id', 'route_id')
--   ORDER BY table_name, column_name;
--
-- STEP 2 — Pick the right block below.

-- =============================================================================
-- A) routes.id is already text, only route_assignments / route_optimizations wrong
--    (keeps your existing route rows) — COMMENTED: use B when routes.id is integer.
-- =============================================================================
-- BEGIN;
-- DROP TABLE IF EXISTS route_optimizations;
-- DROP TABLE IF EXISTS route_assignments;
--
-- CREATE TABLE route_assignments (
--   id TEXT PRIMARY KEY,
--   route_id TEXT NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
--   aircraft_type TEXT NOT NULL,
--   config_y INTEGER NOT NULL,
--   config_j INTEGER NOT NULL,
--   config_f INTEGER NOT NULL,
--   position INTEGER NOT NULL
-- );
-- CREATE INDEX IF NOT EXISTS idx_route_assignments_route ON route_assignments(route_id);
--
-- CREATE TABLE route_optimizations (
--   route_id TEXT PRIMARY KEY REFERENCES routes(id) ON DELETE CASCADE,
--   calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
--   result_json JSONB NOT NULL
-- );
-- COMMIT;

-- =============================================================================
-- B) routes.id is INTEGER / wrong — reset routes + children (DESTROYS route data)
-- =============================================================================
BEGIN;
DROP TABLE IF EXISTS route_optimizations;
DROP TABLE IF EXISTS route_assignments;
DROP TABLE IF EXISTS routes;

CREATE TABLE routes (
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
CREATE TABLE route_assignments (
  id TEXT PRIMARY KEY,
  route_id TEXT NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  aircraft_type TEXT NOT NULL,
  config_y INTEGER NOT NULL,
  config_j INTEGER NOT NULL,
  config_f INTEGER NOT NULL,
  position INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_route_assignments_route ON route_assignments(route_id);
CREATE TABLE route_optimizations (
  route_id TEXT PRIMARY KEY REFERENCES routes(id) ON DELETE CASCADE,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  result_json JSONB NOT NULL
);
COMMIT;
