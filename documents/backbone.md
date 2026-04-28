# Jetwise – Source of Truth Backbone v2

This document defines the **canonical data model, calculation engine, and system architecture** for Jetwise.
Everything in the system must conform to this specification. When in doubt, this file wins.

---

## CHANGELOG FROM v1

- Weekly trip model replaces daily trip model
- Fleet assignment layer added (aircraft → route mapping)
- Hub structure added
- Mixed-aircraft optimization per route (A380 + A330 combos)
- Current vs optimized comparison model added
- Fleet-level reallocation engine added
- Marginal aircraft value calculation added
- Scheduling efficiency model added
- Route data model expanded with current assignment fields

---

# 1. COMPANY (GLOBAL STATE)

## Identity
- Company Name: Jet Wise
- Game Mode: REALISM
- Game Mode Note: All cost inputs and formulas assume REALISM scaling

## Rank & Level
- Rank: 7104
- Level: 168

## Financial
- Cash Balance: 156,550,500
- Share Value: 474.06
- IPO Status: Active

## Training / Efficiency
- Fuel Training (%): 100
- CO2 Training (%): 100
- Repair Training (%): 100
- Load Factor (decimal): 1.0
- Cargo Load (%): 0 (not used for PAX calculations)

## Market Inputs (Dynamic — update as market changes)
- Fuel Price: 500
- CO2 Price: 120
- Cost Index (CI): 200

## Derived (DO NOT INPUT — calculated from above)
- Effective Fuel Multiplier = (1 - fuel_training / 100)
- Effective CO2 Multiplier = (1 - co2_training / 100)
- Effective Repair Multiplier = (1 - 2 × repair_training / 100)

---

# 2. AIRCRAFT (PER TYPE)

Two aircraft types in active fleet. Both defined below. No other types modeled.

---

## Airbus A380-800

### Identity
- Name: Airbus A380-800
- Short Code: A380
- Type: PAX

### Core Specs
- Capacity (units): 600
- Range (km): 14,500
- Speed (km/h): 1,049
- Runway Requirement: 9,680

### Economics
- Purchase Cost: $215,629,503
- A-Check Cost: $12,937,770
- Maintenance Interval (hours): 450

### Efficiency
- Fuel Burn (lbs/km): 22.26
- CO2 Factor (kg per capacity unit per km): 0.16

---

## Airbus A330-800 NEO

### Identity
- Name: Airbus A330-800 NEO
- Short Code: A330
- Type: PAX

### Core Specs
- Capacity (units): 406
- Range (km): 13,900
- Speed (km/h): 801
- Runway Requirement: 9,500

### Economics
- Purchase Cost: $85,235,684
- A-Check Cost: $3,423,028
- Maintenance Interval (hours): 510

### Efficiency
- Fuel Burn (lbs/km): 12.00
- CO2 Factor (kg per capacity unit per km): 0.15

---

# 3. NETWORK STRUCTURE

## Hub and Spoke Model
All routes originate or terminate at one of 7 company hubs.
Routes are out-and-back: aircraft depart hub, fly to destination, return to hub, repeat.
Aircraft are dedicated to a single route — no chaining, no triangle routing.

## Active Hubs
- KMIA — Miami International Airport (Miami, FL)
- KSPG — St. Pete–Clearwater International (St. Pete, FL)
- KFLL — Fort Lauderdale–Hollywood International (Fort Lauderdale, FL)
- KJFK — John F. Kennedy International (New York, NY)
- YMML — Melbourne Airport (Melbourne, Australia)
- EDDF — Frankfurt Airport (Frankfurt, Germany)
- OMDB — Dubai International Airport (Dubai, UAE)

## Technical Stops
Some long-haul routes require a technical stop for range (e.g., EDDF→YSSY via VVTH).
Technical stops are operationally necessary but economically invisible:
- Fuel burn calculates on full origin-to-destination distance at departure
- Revenue and demand calculate on full O&D pair
- No mid-route boarding or deplaning modeled
- Distance used in all formulas = full great circle O&D distance

---

# 4. ROUTE DATA MODEL

Each route stores both static inputs and dynamic state.

## Static Fields (enter once, rarely change)
```
id:              string        — unique route identifier
origin:          ICAO string   — departure hub
destination:     ICAO string   — destination airport
distance:        number (km)   — great circle distance, full O&D
hub:             ICAO string   — which of the 7 hubs this route belongs to
demand:
  y:             number        — economy demand (seats)
  j:             number        — business demand (seats)
  f:             number        — first class demand (seats)
technical_stop:  ICAO | null   — intermediate stop if required, else null
status:          "active" | "inactive"
created_at:      timestamp
```

## Current Assignment (what you actually have deployed)
```
current:
  aircraft:
    - type:      "A380" | "A330"
      config:
        y:       number        — economy seats configured
        j:       number        — business seats configured
        f:       number        — first class seats configured
  # one entry per aircraft assigned to this route
  # e.g., two A380s = two entries
  notes:         string | null — optional operator notes
```

## Optimized Output (system calculated — never manually input)
```
optimized:
  fleet_mix:
    - type:      "A380" | "A330"
      config:
        y:       number
        j:       number
        f:       number
      trips_per_week:     number
      profit_per_flight:  number
      profit_per_week:    number
  total_profit_per_week:  number
  marginal_a330_value:    number  — additional weekly profit of adding one A330 to route
  marginal_a380_value:    number  — additional weekly profit of adding one A380 to route
  scheduling:
    flight_time_hours:    number  — one-way flight time
    trips_per_week:       number  — actual weekly trips per aircraft
    trip_bracket:         number  — rounded trips/day equivalent band (scheduling UI)
```

## Comparison Output (system calculated)
```
comparison:
  current_profit_per_week:    number
  optimized_profit_per_week:  number
  delta_per_week:             number   — optimized minus current
  delta_per_aircraft_per_week: number  — average delta per aircraft assigned
  current_demand_fulfilled:   number   — % of total demand capacity served by current config
  optimized_demand_fulfilled: number   — % of total demand capacity served by optimized config
```

---

# 5. TICKET PRICING MODEL

## Game Mode: REALISM

All prices are per seat, one-way, per flight.

```
Economy (Y):  1.10 × (0.3 × distance + 150) − 2
Business (J): 1.08 × (0.6 × distance + 500) − 2
First (F):    1.06 × (0.9 × distance + 1000) − 2
```

Prices are deterministic — fully calculated from distance. No dynamic market pricing.
Prices apply equally to both A380 and A330 on the same route.

---

# 6. SEAT CONFIGURATION MODEL

## Capacity Constraint (per aircraft)
```
Y + 2J + 3F ≤ aircraft.capacity
Y ≤ remaining_demand.y
J ≤ remaining_demand.j
F ≤ remaining_demand.f
```

Where remaining_demand is total route demand minus demand already fulfilled
by previously assigned aircraft on the same route.

## Revenue per Capacity Unit (used for greedy allocation priority)
```
eco_value   = price_y / 1
bus_value   = price_j / 2
first_value = price_f / 3
```

Allocate capacity greedily in descending order of value per unit.

## Multi-Aircraft Demand Partitioning
When multiple aircraft serve a route, demand is consumed sequentially:
1. Optimize first aircraft against full demand
2. Subtract fulfilled demand
3. Optimize second aircraft against remaining demand
4. Continue until demand is exhausted or additional aircraft are unprofitable

Note: Order of aircraft assignment affects config. The system must evaluate
all valid fleet combinations and select the globally optimal assignment,
not just greedily assign the first best aircraft.

---

# 7. COST MODEL

All costs are per one-way flight.

## Fuel Cost
```
fuel_lbs = (1 - fuel_training/100)
           × distance
           × aircraft.fuel
           × (CI/500 + 0.6)

fuel_cost = fuel_lbs × fuel_price / 1000
```

## CO2 Cost
```
cap_units = Y + 2J + 3F
seats     = Y + J + F

co2_units = (1 - co2_training/100)
            × [distance × aircraft.co2 × cap_units × load + seats]
            × (CI/2000 + 0.9)

co2_cost = co2_units × co2_price / 1000
```

## A-Check Cost
```
acheck_cost = aircraft.check_cost
              × ceil(flight_time_hours)
              / aircraft.maintenance_interval
```

Note: Values in this backbone are sourced directly from a REALISM-mode account.
No additional multiplier needed. If aircraft data is sourced from base game data,
apply: acheck_cost × 2.

## Repair Cost
```
repair_cost = aircraft.purchase_cost
              × 0.0075
              × (1 - 2 × repair_training/100)
```

## Total Cost Per Flight
```
total_cost = fuel_cost + co2_cost + acheck_cost + repair_cost
```

---

# 8. FLIGHT MODEL

## Game Mode Multiplier
- REALISM: 1.0 (no speed multiplier)
- EASY: 1.5 (not used — REALISM only)

## Effective Speed
```
speed_effective = aircraft.speed × (0.0035 × CI + 0.3)
```

## Flight Time (one-way)
```
flight_time_hours = distance / speed_effective
```

## Weekly Trip Calculation
This is the canonical trip model. Daily models are derived from weekly, not the reverse.

```
MINUTES_PER_WEEK = 7 × 24 × 60 = 10,080

flight_time_minutes = flight_time_hours × 60

trips_per_week = floor(MINUTES_PER_WEEK / flight_time_minutes)
```

Rationale: A pure weekly model correctly captures remainder accumulation
that per-day floor() calculations miss. A route with an 8:10 flight time
gets floor(10080/490) = 20 trips/week, vs a naive 2×7=14 from daily floor().

## Scheduling Bracket Analysis
Classify routes by their natural scheduling bracket for operator awareness:

```
trips_per_day_equivalent = trips_per_week / 7

bracket = closest clean integer (2, 3, 4, etc.)
threshold_minutes = floor(MINUTES_PER_WEEK / (bracket + 1)) - flight_time_minutes
```

A positive threshold_minutes means the route is this many minutes above the threshold
for one additional trip per day equivalent. Surface this in the UI as an insight.

---

# 9. PROFIT MODEL

## Per Flight (per aircraft)
```
revenue_per_flight = Y × price_y + J × price_j + F × price_f
profit_per_flight  = revenue_per_flight - total_cost
```

## Per Week (per aircraft)
```
profit_per_week = profit_per_flight × trips_per_week
```

## Per Route (all aircraft combined)
```
route_profit_per_week = sum of profit_per_week across all aircraft on route
```

## Daily Asset Yield (for fleet ranking — derived from weekly)
```
daily_asset_yield = profit_per_week / 7
```

This is the primary metric for fleet-level comparison and reallocation decisions.
An aircraft's daily_asset_yield tells you what that asset earns on average per day
accounting for actual weekly trip count, not theoretical maximum.

---

# 10. ROUTE OPTIMIZER

## Purpose
Given a route's demand, distance, and the two aircraft types, find the fleet mix
and seat configuration that maximizes total route_profit_per_week.

## Inputs
```
distance:   number (km)
demand:     { y, j, f }
aircraft:   [A380, A330]
company:    global company state
```

## Fleet Combination Candidates
Enumerate all valid fleet mixes up to a reasonable cap (AM4 max: 4 aircraft per route):

```
Candidates:
  [1× A380]
  [1× A330]
  [2× A380]
  [2× A330]
  [1× A380, 1× A330]
  [3× A380]
  [3× A330]
  [2× A380, 1× A330]
  [1× A380, 2× A330]
  [4× A380]
  [4× A330]
  [3× A380, 1× A330]
  [2× A380, 2× A330]
  [1× A380, 3× A330]
  ... (up to 4 total aircraft)
```

## Evaluation Per Candidate
For each fleet combination:
1. Sort aircraft by profitability (evaluate each type alone first)
2. Assign first aircraft against full demand → get config and profit
3. Subtract fulfilled demand
4. Assign second aircraft against remaining demand → get config and profit
5. Continue for all aircraft in combination
6. If any aircraft in the combination has profit_per_flight ≤ 0, discard combination
7. Sum route_profit_per_week for the combination

## Selection
Select the combination with the highest route_profit_per_week.

## Marginal Value Calculation
After selecting optimal fleet mix:
```
marginal_a330_value = profit(optimal_mix + 1× A330) - profit(optimal_mix)
marginal_a380_value = profit(optimal_mix + 1× A380) - profit(optimal_mix)
```

If marginal value ≤ 0, the aircraft adds no value to this route.
These values feed the fleet-level reallocation engine.

---

# 11. FLEET ASSIGNMENT MODEL

## Purpose
Track which physical aircraft are assigned where, and evaluate whether
reallocation would improve total fleet profit.

## Fleet Registry
Each aircraft in the fleet has an entry:
```
aircraft_id:     string         — unique identifier
type:            "A380" | "A330"
route_id:        string         — currently assigned route
hub:             ICAO string    — home hub
weekly_yield:    number         — current actual profit per week
optimized_yield: number         — what this aircraft could earn on its current route optimally
```

## Fleet-Level Metrics
```
fleet_total_weekly_profit:   sum of all aircraft weekly_yield
fleet_average_weekly_yield:  fleet_total_weekly_profit / total_aircraft
fleet_a380_average_yield:    average weekly_yield for A380s only
fleet_a330_average_yield:    average weekly_yield for A330s only
```

---

# 12. FLEET REALLOCATION ENGINE

## Purpose
Identify aircraft that are underperforming relative to opportunities elsewhere.
Suggest swaps that increase total fleet profit.

## Core Algorithm: Marginal Value Matching

Step 1 — Score every secondary aircraft by marginal contribution:
```
For each route with 2+ aircraft:
  Identify the lowest-contributing aircraft (secondary)
  marginal_contribution = route_profit_with_aircraft - route_profit_without_aircraft
```

Step 2 — Score every route by marginal gain from adding an aircraft:
```
For each route:
  marginal_gain_a380 = already calculated in optimizer
  marginal_gain_a330 = already calculated in optimizer
```

Step 3 — Find beneficial swaps:
```
For each secondary aircraft (type T, marginal_contribution = C):
  Find routes where marginal_gain for type T > C
  Net gain = marginal_gain - C
  If net_gain > 0: flag as reallocation opportunity
```

Step 4 — Rank opportunities by net_gain descending.

## Reallocation Suggestion Output
```
{
  from_route:          string (route_id)
  to_route:            string (route_id)
  aircraft_type:       "A380" | "A330"
  current_contribution: number ($/week)
  potential_gain:      number ($/week)
  net_fleet_gain:      number ($/week)
  confidence:          "high" | "medium" | "low"
}
```

Confidence levels:
- high: net_gain > 20% of current contribution
- medium: net_gain 5–20% of current contribution
- low: net_gain < 5% of current contribution

---

# 13. UI VIEWS (PWA — mobile and tablet primary)

## View 1: Fleet Dashboard (home)
Primary view. Shows fleet health at a glance.

Displays:
- Fleet total weekly profit
- Fleet average daily asset yield
- Count of aircraft below fleet average (flagged)
- Count of reallocation opportunities
- Quick links to each hub's route list

## View 2: Route List
Per-hub or all-routes view. Each route card shows:
- Origin → Destination
- Current fleet assignment (aircraft types + count)
- Current weekly profit
- Optimized weekly profit
- Delta (color coded: green positive, red negative gap)
- Flight time + trips per week
- Scheduling bracket + threshold proximity warning if within 30min of next bracket

## View 3: Route Detail
Full analysis for one route.

Displays:
- Route metadata (distance, demand, hub, technical stop if any)
- Current assignment: each aircraft with its config (Y/J/F) and weekly profit
- Optimized assignment: each aircraft with its config and weekly profit
- Side-by-side comparison table
- Marginal value of adding one A330 / one A380
- Scheduling analysis: flight time, trips/week, bracket, threshold proximity
- Demand fulfillment: current % vs optimized %

## View 4: Add / Edit Route
Mobile-friendly form. Fields:
- Origin ICAO (text, auto-caps)
- Destination ICAO (text, auto-caps)
- Distance (number, km)
- Demand: Y, J, F (three number inputs)
- Hub (select from 7 hubs)
- Technical stop ICAO (optional)
- Current assignment: add aircraft rows (type + Y/J/F config per aircraft)

On save: triggers optimizer to calculate optimized and comparison fields.

## View 5: Fleet Reallocation
List of suggested swaps ranked by net fleet gain.

Each suggestion shows:
- Aircraft type
- Move from: route name + current contribution/week
- Move to: route name + potential gain/week
- Net fleet gain/week
- Confidence indicator

## View 6: Hub View
Per-hub summary:
- Routes operating from this hub
- Aircraft count at hub
- Hub total weekly profit
- Hub average daily asset yield vs fleet average

---

# 14. DATA PERSISTENCE

## Storage
Use a database (e.g., Vercel Postgres, PlanetScale, or SQLite via Turso).
Do NOT store route data in flat files or local JSON.
The app must be accessible across devices (PWA on mobile + tablet).

## Tables (minimum viable schema)

### routes
```
id              TEXT PRIMARY KEY
origin          TEXT NOT NULL
destination     TEXT NOT NULL
distance        REAL NOT NULL
hub             TEXT NOT NULL
demand_y        INTEGER NOT NULL
demand_j        INTEGER NOT NULL
demand_f        INTEGER NOT NULL
technical_stop  TEXT
status          TEXT DEFAULT 'active'
notes           TEXT
created_at      TIMESTAMP DEFAULT now()
updated_at      TIMESTAMP DEFAULT now()
```

### route_assignments (current actual deployment)
```
id              TEXT PRIMARY KEY
route_id        TEXT REFERENCES routes(id)
aircraft_type   TEXT NOT NULL  -- 'A380' | 'A330'
config_y        INTEGER NOT NULL
config_j        INTEGER NOT NULL
config_f        INTEGER NOT NULL
position        INTEGER NOT NULL  -- 1, 2, 3... (order on route)
```

### route_optimizations (system calculated, cached)
```
id              TEXT PRIMARY KEY
route_id        TEXT REFERENCES routes(id)
calculated_at   TIMESTAMP
result_json     JSONB  -- full optimizer output
```

### company_settings (single row)
```
fuel_price      REAL
co2_price       REAL
fuel_training   REAL
co2_training    REAL
repair_training REAL
load_factor     REAL
ci              REAL
updated_at      TIMESTAMP
```

---

# 15. API ROUTES

```
GET    /api/routes                    — list all routes
POST   /api/routes                    — create route
GET    /api/routes/:id                — get route with current + optimized
PUT    /api/routes/:id                — update route (demand, assignment, etc.)
DELETE /api/routes/:id                — delete route

POST   /api/routes/:id/optimize       — run optimizer for one route
POST   /api/optimize-all              — run optimizer for all routes

GET    /api/fleet                     — fleet summary + reallocation suggestions
GET    /api/fleet/reallocation        — reallocation suggestions only

GET    /api/hubs                      — hub summaries
GET    /api/hubs/:icao                — specific hub detail

GET    /api/company                   — company settings
PUT    /api/company                   — update company settings (fuel price, CI, etc.)
```

---

# 16. CALCULATION CONSTANTS

```
MINUTES_PER_WEEK  = 10,080
REALISM_SPEED_MULTIPLIER = 1.0
MAX_AIRCRAFT_PER_ROUTE   = 4
CI_DEFAULT               = 200
```

---

# 17. KNOWN GAPS & FUTURE EXTENSIONS

Items explicitly out of scope for v1 but tracked here:

- CI optimization per route (find optimal CI that maximizes profit by bracket)
- Fuel price / CO2 price sensitivity analysis
- Double-demand promo event modeling
- Fleet expansion recommendations (when to buy new aircraft)
- Route opening recommendations (unserved demand analysis)
- Historical profit tracking over time
- Automated redeployment scheduling assistant
- Hub-to-hub rebalancing (moving aircraft between hubs, not just routes)

---

# FINAL NOTE

This file is the **single source of truth for Jetwise v2**.
All calculations, data models, API contracts, and UI decisions must conform to this specification.
When real-world AM4 behavior conflicts with this spec, update this spec first, then propagate.
Do not implement features not described here without updating this document first.