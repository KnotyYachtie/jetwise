#!/usr/bin/env python3
"""
Reconstruct AM4-style route pairs from airport-ordered matrices.

Supports:
  - Full N×N row-major: row_count == N²  → origin_idx = row // N, dest_idx = row % N
  - Upper triangle (no diagonal): row_count == N*(N-1)/2 → row order matches sorted (i<j)

Uses Polars only — vectorized; no loops over route rows.

Outputs ICAO-first endpoint codes for Jetwise, cabin demand splits (demand_y/j/f),
distance_km from matrix column `d`, plus directional expansion for upper triangle.
"""

from __future__ import annotations

import sys
from pathlib import Path

import polars as pl

DOWNLOADS = Path.home() / "Downloads"
AIRPORTS_PATH = DOWNLOADS / "airports.parquet"
LONG_AIRPORTS_PATH = DOWNLOADS / "long_airports.parquet"
ROUTES_PATH = DOWNLOADS / "routes.parquet"
OUTPUT_PATH = DOWNLOADS / "final_routes.parquet"
OUTPUT_DIRECTIONAL_PATH = DOWNLOADS / "final_routes_directional.parquet"


def valid_codes_from_long_airports(long_ap: pl.DataFrame) -> list[str]:
    """Both IATA and ICAO from long_airports as uppercase stripped codes."""
    codes = (
        pl.concat(
            [
                long_ap.select(
                    pl.col("iata").cast(pl.Utf8).str.strip_chars().str.to_uppercase().alias("c")
                ),
                long_ap.select(
                    pl.col("icao").cast(pl.Utf8).str.strip_chars().str.to_uppercase().alias("c")
                ),
            ],
            how="vertical",
        )
        .unique()
        .filter(pl.col("c").is_not_null() & (pl.col("c").str.len_chars() > 0))
    )
    return codes["c"].to_list()


def upper_triangle_pairs_lf(n: int) -> pl.LazyFrame:
    """Sorted pairs with origin_idx < destination_idx — canonical row-major upper triangle."""
    return (
        pl.LazyFrame()
        .select(pl.int_range(0, n, dtype=pl.UInt32).alias("origin_idx"))
        .join(
            pl.LazyFrame().select(pl.int_range(0, n, dtype=pl.UInt32).alias("destination_idx")),
            how="cross",
        )
        .filter(pl.col("origin_idx") < pl.col("destination_idx"))
        .sort(["origin_idx", "destination_idx"])
        .with_row_index("row")
    )


def origin_destination_luts(airports: pl.DataFrame) -> tuple[pl.LazyFrame, pl.LazyFrame]:
    """Per-airport lookup vs export ICAO-first codes."""
    iata_u = pl.col("iata").cast(pl.Utf8).str.strip_chars().str.to_uppercase()
    icao_u = pl.col("icao").cast(pl.Utf8).str.strip_chars().str.to_uppercase()
    lookup_code = (
        pl.when(iata_u.is_not_null() & (iata_u.str.len_chars() > 0))
        .then(iata_u)
        .otherwise(icao_u)
        .alias("lookup_code")
    )
    export_code = (
        pl.when(icao_u.is_not_null() & (icao_u.str.len_chars() > 0))
        .then(icao_u)
        .otherwise(iata_u)
        .alias("export_code")
    )
    base = airports.select(pl.col("idx"), lookup_code, export_code)
    origin_lut = base.rename({"idx": "origin_idx", "lookup_code": "o_lookup", "export_code": "origin"})
    dest_lut = base.rename({"idx": "destination_idx", "lookup_code": "d_lookup", "export_code": "destination"})
    return origin_lut.lazy(), dest_lut.lazy()


def main() -> None:
    airports = pl.read_parquet(AIRPORTS_PATH)
    long_airports = pl.read_parquet(LONG_AIRPORTS_PATH)

    airports = airports.with_row_index("idx")
    n = airports.height

    routes_lf = pl.scan_parquet(ROUTES_PATH)
    schema = routes_lf.collect_schema()
    expected_cols = {"yd", "jd", "fd", "d"}
    if set(schema.names()) != expected_cols:
        print("error: routes.parquet schema mismatch.", file=sys.stderr)
        print(f"  expected columns: {sorted(expected_cols)}", file=sys.stderr)
        print(f"  got: {schema.names()}", file=sys.stderr)
        sys.exit(1)

    rows_count = routes_lf.select(pl.len()).collect(engine="streaming").item()
    n_sq = n * n
    triangular_count = n * (n - 1) // 2

    print(f"airports N = {n}")
    print(f"routes row count = {rows_count}")
    print(f"N^2              = {n_sq}")
    print(f"N*(N-1)/2        = {triangular_count} (upper triangle, no diagonal)")

    route_attrs = (
        pl.col("yd").cast(pl.UInt32).alias("demand_y"),
        pl.col("jd").cast(pl.UInt32).alias("demand_j"),
        pl.col("fd").cast(pl.UInt32).alias("demand_f"),
        pl.col("d").cast(pl.Float64).alias("distance_km"),
    )

    if rows_count == n_sq:
        mapping_mode = "full_NxN_row_major"
        with_indices = routes_lf.with_row_index("row").with_columns(
            (pl.col("row") // n).alias("origin_idx"),
            (pl.col("row") % n).alias("destination_idx"),
            *route_attrs,
        )
    elif rows_count == triangular_count:
        mapping_mode = "upper_triangle_sorted_ij"
        pairs_lf = upper_triangle_pairs_lf(n)
        with_indices = (
            routes_lf.with_row_index("row").join(pairs_lf, on="row", how="inner").with_columns(*route_attrs)
        )
    else:
        sys.stdout.flush()
        print(
            "\n*** STOP: routes row count matches neither N^2 nor N*(N-1)/2. "
            "Matrix layout assumption is wrong. ***\n",
            file=sys.stderr,
        )
        print(f"  rows / N       = {rows_count / n:.10g}", file=sys.stderr)
        print(f"  rows / N^2     = {rows_count / n_sq:.10g}", file=sys.stderr)
        print(
            f"  rows / (N*(N-1)/2) = {rows_count / triangular_count:.10g}",
            file=sys.stderr,
        )
        print(
            "\nDiagnostic: verify airports.parquet row order matches the matrix export.",
            file=sys.stderr,
        )
        sys.exit(2)

    valid_list = valid_codes_from_long_airports(long_airports)
    origin_lut, dest_lut = origin_destination_luts(airports)

    built_lf = (
        with_indices.join(origin_lut, on="origin_idx", how="left")
        .join(dest_lut, on="destination_idx", how="left")
        .filter(pl.col("o_lookup").is_in(valid_list) & pl.col("d_lookup").is_in(valid_list))
        .select(["origin", "destination", "demand_y", "demand_j", "demand_f", "distance_km"])
    )

    filtered = built_lf.collect(engine="streaming")

    filtered.write_parquet(OUTPUT_PATH)

    before_directional = len(filtered)

    flipped = filtered.select(
        pl.col("destination").alias("origin"),
        pl.col("origin").alias("destination"),
        pl.col("demand_y"),
        pl.col("demand_j"),
        pl.col("demand_f"),
        pl.col("distance_km"),
    )

    directional = (
        pl.concat([filtered, flipped], how="vertical")
        .unique(
            subset=["origin", "destination", "demand_y", "demand_j", "demand_f", "distance_km"],
            keep="first",
        )
        .select(["origin", "destination", "demand_y", "demand_j", "demand_f", "distance_km"])
    )

    directional.write_parquet(OUTPUT_DIRECTIONAL_PATH)

    after_directional = len(directional)

    print(f"mapping mode: {mapping_mode}")
    print(f"total routes before (matrix rows): {rows_count}")
    print(f"total routes after filter:          {before_directional}")
    print(f"directional row count before expansion: {before_directional}")
    print(f"directional row count after expansion:  {after_directional}")
    print(filtered.head(20))


if __name__ == "__main__":
    main()
