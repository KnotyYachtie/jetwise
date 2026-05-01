#!/usr/bin/env python3
"""Keep routes whose origin & destination appear in long_airports (IATA or ICAO).

Vectorized Polars only: lazy scan, hash joins, streaming collect — no Python row loops.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import polars as pl

DOWNLOADS = Path.home() / "Downloads"
DEFAULT_AIRPORTS = DOWNLOADS / "long_airports.parquet"
DEFAULT_ROUTES = DOWNLOADS / "routes.parquet"
DEFAULT_OUTPUT = DOWNLOADS / "filtered_routes.parquet"

REQUIRED_ROUTE_COLS = ("origin", "destination", "demand")


def valid_airport_codes(airports: pl.DataFrame) -> pl.DataFrame:
    """Single-column frame `code`: uppercase IATA + ICAO (unique)."""
    return (
        pl.concat(
            [
                airports.select(
                    pl.col("iata").cast(pl.Utf8).str.strip_chars().str.to_uppercase().alias("code")
                ),
                airports.select(
                    pl.col("icao").cast(pl.Utf8).str.strip_chars().str.to_uppercase().alias("code")
                ),
            ],
            how="vertical",
        )
        .unique()
        .filter(pl.col("code").is_not_null() & (pl.col("code").str.len_chars() > 0))
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Filter routes by long_airports codes")
    parser.add_argument("--airports", type=Path, default=DEFAULT_AIRPORTS)
    parser.add_argument("--routes", type=Path, default=DEFAULT_ROUTES)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    airports = pl.read_parquet(args.airports)
    valid_df = valid_airport_codes(airports)

    scan = pl.scan_parquet(args.routes)
    schema_names = scan.collect_schema().names()
    missing = [c for c in REQUIRED_ROUTE_COLS if c not in schema_names]
    if missing:
        print(
            f"error: routes.parquet must include columns {list(REQUIRED_ROUTE_COLS)}; "
            f"missing {missing}. Found: {schema_names}",
            file=sys.stderr,
        )
        sys.exit(1)

    n_before = scan.select(pl.len()).collect(engine="streaming").item()

    # Small (~2k) code list — hash lookups per row inside Polars (no per-row Python).
    valid_list = valid_df["code"].to_list()

    routes_norm = scan.with_columns(
        pl.col("origin").cast(pl.Utf8).str.strip_chars().str.to_uppercase(),
        pl.col("destination").cast(pl.Utf8).str.strip_chars().str.to_uppercase(),
    ).filter(pl.col("origin").is_in(valid_list) & pl.col("destination").is_in(valid_list))

    filtered = routes_norm.select(["origin", "destination", "demand"]).collect(engine="streaming")

    filtered.write_parquet(args.output)

    print(f"Routes before: {n_before}")
    print(f"Routes after:  {len(filtered)}")
    print(filtered.head(20))


if __name__ == "__main__":
    main()
