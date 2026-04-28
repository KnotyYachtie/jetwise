-- Run once on existing DBs that already have airport_lookup (adds IATA for search).
-- Fresh installs: use db/airport_lookup.sql which includes iata.

ALTER TABLE airport_lookup ADD COLUMN IF NOT EXISTS iata TEXT;

CREATE INDEX IF NOT EXISTS idx_airport_lookup_iata ON airport_lookup (iata);
