

# Jetwise – Source of Truth Backbone

This document defines the **canonical data model** for your optimizer. Everything in your system should map back to this structure.

---

# 1. COMPANY (GLOBAL STATE)

## Identity
- Company Name: Jet Wise
- Game Mode: REALISM
- Game Mode Note: All cost inputs and formulas assume REALISM scaling
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

## Market Inputs (Dynamic)
- Fuel Price: 500
- CO2 Price: 120
- Cost Index (CI): 200

## Derived (DO NOT INPUT)
- Effective Fuel Multiplier = (1 - fuel_training/100)
- Effective CO2 Multiplier = (1 - co2_training/100)
- Effective Repair Multiplier = (1 - 2 * repair_training/100)

---

# 2. AIRCRAFT (PER TYPE)

Each aircraft must be defined as a separate structured block.

---

## Airbus A380-800

### Identity
- Name: Airbus A380-800
- Type: PAX

### Core Specs
- Capacity (units): 600
- Range (km): 14500
- Speed (km/h): 1049
- Runway Requirement: 9680

### Economics
- Purchase Cost: 215629503
- A-Check Cost: 12937770
- Maintenance Interval (hours): 450

### Efficiency
- Fuel Burn (lbs/km): 22.26
- CO2 Factor (kg per capacity unit per km): 0.16

---

## Airbus A330-800 NEO

### Identity
- Name: Airbus A330-800 NEO
- Type: PAX

### Core Specs
- Capacity (units): 406
- Range (km): 13900
- Speed (km/h): 801
- Runway Requirement: 9500

### Economics
- Purchase Cost: 85235684
- A-Check Cost: 3423028
- Maintenance Interval (hours): 510

### Efficiency
- Fuel Burn (lbs/km): 12.00
- CO2 Factor (kg per capacity unit per km): 0.15

---

# 3. ROUTE INPUT (PER ROUTE)

## Identity
- Origin ICAO:
- Destination ICAO:

- Distance (km): (great circle distance from API)
- Demand:
  - Economy:
  - Business:
  - First:

## Derived Demand Units
- Total Capacity Units = Y + 2J + 3F

---

# 4. TICKET PRICING (DETERMINISTIC)

## REALISM MODE
- Economy: 1.10 × (0.3 × distance + 150) − 2
- Business: 1.08 × (0.6 × distance + 500) − 2
- First: 1.06 × (0.9 × distance + 1000) − 2

## EASY MODE
- Economy: 1.10 × (0.4 × distance + 170) − 2
- Business: 1.08 × (0.8 × distance + 560) − 2
- First: 1.06 × (1.2 × distance + 1200) − 2

---

# 5. SEAT CONFIGURATION MODEL

## Constraint
Y + 2J + 3F ≤ Capacity
Y ≤ demand_Y
J ≤ demand_J
F ≤ demand_F

## Objective
Maximize:
Revenue = Y·Ry + J·Rj + F·Rf

## Strategy (Recommended)
- Compute revenue per capacity unit:
  - Eco = Ry / 1
  - Bus = Rj / 2
  - First = Rf / 3
- Allocate capacity greedily by highest value

---

# 6. COST MODEL

## Fuel
Fuel (lbs per flight) =
  (1 - fuel_training/100)
  × distance
  × aircraft.fuel
  × (CI/500 + 0.6)

## CO2
CO2 (units per flight) =
  (1 - co2_training/100)
  × [distance × aircraft.co2 × (Y + 2J + 3F) × load + (Y + J + F)]
  × (CI/2000 + 0.9)

## A-Check
A-Check Cost (per flight) =
  aircraft.check_cost
  × ceil(flight_time)
  / maintenance_interval

Note:
- In REALISM mode, A-check costs are effectively doubled in-game. If using base aircraft data, apply:
  A-Check × 2
- If values are pulled directly from a REALISM account (as above), no additional multiplier is needed.

## Repair
Repair Cost (per flight) =
  aircraft.purchase_cost
  × 0.0075
  × (1 - 2 × repair_training/100)

## Total Cost
Cost =
  (Fuel × fuel_price / 1000)
+ (CO2 × co2_price / 1000)
+ A-Check
+ Repair

---

# 7. FLIGHT MODEL

## Speed Multiplier
- EASY: 1.5
- REALISM: 1.0

## Effective Speed
speed_effective = speed × (0.0035 × CI + 0.3)

## Flight Time
flight_time = distance / speed_effective

## Trips Per Day
TPD = floor(24 / flight_time)

---

# 8. PROFIT MODEL

## Per Flight
Revenue = Y·Ry + J·Rj + F·Rf
Profit = Revenue − Cost

## Per Day (per aircraft)
Daily Profit = Profit × Trips Per Day

---

# 9. OPTIMIZER CORE (YOUR ENGINE)

## Inputs
- Route demand
- Aircraft list
- Company state

## Loop (Greedy Profit Maximization)
Initialize remaining_demand = total demand

While remaining_demand > 0:
  For each aircraft:
    - Solve optimal seat config using remaining_demand
    - Calculate per-flight profit
    - Calculate profit per capacity unit

  Select aircraft with highest profit per capacity unit

  If profit ≤ 0:
    break

  Assign aircraft
  Subtract fulfilled demand from remaining_demand

Return full aircraft mix + configs

---

# 10. API INTEGRATION PLAN

## Pull from AM4 API
- Route Demand
- Distance
- User Info (training, load, etc.)

## Store Locally
- Aircraft specs (manual or curated)

---

# 11. FUTURE EXTENSIONS

- CI Optimization (speed vs fuel tradeoff)
- Load factor tuning
- Multi-route optimization
- Fleet-wide scheduling
- UI dashboard
- Vectorized evaluation for batch route optimization
- Caching layer for repeated route calculations
- Parallel evaluation across aircraft types

---

# FINAL NOTE

This file is the **single source of truth**.
All calculations, models, and future features must conform to this structure.