#!/usr/bin/env python3
"""Slice directional routes to hub-outbounds for Jetwise CSV seed (Polars-only)."""

from __future__ import annotations

from pathlib import Path

import polars as pl

DOWNLOADS = Path.home() / "Downloads"
DIRECTIONAL_PATH = DOWNLOADS / "final_routes_directional.parquet"
CSV_OUT = DOWNLOADS / "hub_suggestions_seed.csv"

# Mirror web-app/lib/hubs.ts HUBS[].icao
HUB_ICAOS = {"KMIA", "KSPG", "KFLL", "KJFK", "YMML", "EDDF", "OMDB"}

PER_HUB_CAP = 100


def main() -> None:
    df = pl.read_parquet(DIRECTIONAL_PATH)
    hub_rows = df.filter(pl.col("origin").is_in(list(HUB_ICAOS))).with_columns(
        (pl.col("demand_y") + pl.col("demand_j") + pl.col("demand_f")).alias("_tot")
    )
    ranked = hub_rows.sort("_tot", descending=True).group_by("origin").head(PER_HUB_CAP).drop("_tot")
    ranked.write_csv(CSV_OUT)
    print(f"wrote {len(ranked)} rows → {CSV_OUT}")
    print(ranked.head(10))


if __name__ == "__main__":
    main()
