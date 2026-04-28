-- Optional: ICAO lookup for route composer search (non-hub airports).
-- Run after schema.sql. Safe to re-run (ON CONFLICT DO NOTHING).

CREATE TABLE IF NOT EXISTS airport_lookup (
  icao TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT,
  country TEXT,
  iata TEXT,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  airport_type TEXT,
  scheduled_service TEXT
);

CREATE INDEX IF NOT EXISTS idx_airport_lookup_icao ON airport_lookup (icao);
CREATE INDEX IF NOT EXISTS idx_airport_lookup_name ON airport_lookup (name);
CREATE INDEX IF NOT EXISTS idx_airport_lookup_iata ON airport_lookup (iata);

INSERT INTO airport_lookup (icao, name, city, country) VALUES
('EGLL', 'Heathrow Airport', 'London', 'GB'),
('LFPG', 'Charles de Gaulle Airport', 'Paris', 'FR'),
('EHAM', 'Amsterdam Airport Schiphol', 'Amsterdam', 'NL'),
('LEMD', 'Adolfo Suárez Madrid–Barajas', 'Madrid', 'ES'),
('LIRF', 'Rome Fiumicino', 'Rome', 'IT'),
('LSZH', 'Zurich Airport', 'Zurich', 'CH'),
('LOWW', 'Vienna International', 'Vienna', 'AT'),
('UUEE', 'Sheremetyevo', 'Moscow', 'RU'),
('VHHH', 'Hong Kong International', 'Hong Kong', 'HK'),
('RJTT', 'Tokyo Haneda', 'Tokyo', 'JP'),
('RKSI', 'Seoul Incheon', 'Seoul', 'KR'),
('WSSS', 'Singapore Changi', 'Singapore', 'SG'),
('VTBS', 'Suvarnabhumi', 'Bangkok', 'TH'),
('VHHX', 'Kai Tak (historical)', 'Hong Kong', 'HK'),
('YSSY', 'Sydney Kingsford Smith', 'Sydney', 'AU'),
('NZAA', 'Auckland Airport', 'Auckland', 'NZ'),
('CYYZ', 'Toronto Pearson', 'Toronto', 'CA'),
('KATL', 'Hartsfield–Jackson Atlanta', 'Atlanta', 'US'),
('KLAX', 'Los Angeles International', 'Los Angeles', 'US'),
('KORD', "O'Hare International", 'Chicago', 'US'),
('KDFW', 'Dallas/Fort Worth International', 'Dallas', 'US'),
('KDEN', 'Denver International', 'Denver', 'US'),
('KSEA', 'Seattle–Tacoma International', 'Seattle', 'US'),
('KSFO', 'San Francisco International', 'San Francisco', 'US'),
('KPHX', 'Phoenix Sky Harbor', 'Phoenix', 'US'),
('KIAH', 'George Bush Intercontinental', 'Houston', 'US'),
('KCLT', 'Charlotte Douglas', 'Charlotte', 'US'),
('KMCO', 'Orlando International', 'Orlando', 'US'),
('KPHL', 'Philadelphia International', 'Philadelphia', 'US'),
('KSLC', 'Salt Lake City International', 'Salt Lake City', 'US'),
('KDTW', 'Detroit Metropolitan', 'Detroit', 'US'),
('KPDX', 'Portland International', 'Portland', 'US'),
('KSTL', 'St. Louis Lambert', 'St. Louis', 'US'),
('KBOS', 'Logan International', 'Boston', 'US'),
('MMMX', 'Mexico City International', 'Mexico City', 'MX'),
('SBGR', 'São Paulo/Guarulhos', 'São Paulo', 'BR'),
('SCEL', 'Santiago International', 'Santiago', 'CL'),
('SAEZ', 'Ministro Pistarini (Ezeiza)', 'Buenos Aires', 'AR'),
('FACT', 'Cape Town International', 'Cape Town', 'ZA'),
('FAOR', 'O. R. Tambo International', 'Johannesburg', 'ZA')
ON CONFLICT (icao) DO NOTHING;
