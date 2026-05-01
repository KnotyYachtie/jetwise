#!/usr/bin/env python3
"""Filter airports.parquet by runway length and valid IATA/ICAO."""

from pathlib import Path

import polars as pl

DOWNLOADS = Path.home() / "Downloads"
INPUT_PATH = DOWNLOADS / "airports.parquet"
OUTPUT_PATH = DOWNLOADS / "long_airports.parquet"

MIN_RWY = 9500


def main() -> None:
    df = pl.read_parquet(INPUT_PATH)
    filtered = df.filter(
        (pl.col("rwy") >= MIN_RWY)
        & pl.col("iata").is_not_null()
        & pl.col("icao").is_not_null()
    )
    filtered.write_parquet(OUTPUT_PATH)
    print(f"Wrote {len(filtered)} rows → {OUTPUT_PATH}")
    print(filtered)


if __name__ == "__main__":
    main()
