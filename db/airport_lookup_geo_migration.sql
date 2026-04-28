-- Run once on existing airport_lookup (adds geo + optional classification for distance / ranking).

ALTER TABLE airport_lookup ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE airport_lookup ADD COLUMN IF NOT EXISTS lon DOUBLE PRECISION;
ALTER TABLE airport_lookup ADD COLUMN IF NOT EXISTS airport_type TEXT;
ALTER TABLE airport_lookup ADD COLUMN IF NOT EXISTS scheduled_service TEXT;
