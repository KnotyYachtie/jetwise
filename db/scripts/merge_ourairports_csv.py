#!/usr/bin/env python3
"""
Join OurAirports-style CSVs into one airport-level file:
  airports + country fields (iso_country → countries.code)
           + region fields (iso_region → regions.code)

Usage:
  python3 merge_ourairports_csv.py [--slim] airports.csv countries.csv regions.csv [output.csv]

  --slim    Only columns useful for apps / imports / Haversine (drops Wikipedia,
            keywords, links). Default output name becomes airports_slim.csv.

Without --slim: every airport column plus joined country/region metadata (verbose).

Without output path:
  full → airports_with_geo.csv next to airports.csv
  slim → airports_slim.csv next to airports.csv
"""

from __future__ import annotations

import csv
import sys
from pathlib import Path


def load_countries(path: Path) -> dict[str, dict[str, str]]:
    out: dict[str, dict[str, str]] = {}
    with path.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            code = (row.get("code") or "").strip()
            if code:
                out[code] = row
    return out


def load_regions(path: Path) -> dict[str, dict[str, str]]:
    out: dict[str, dict[str, str]] = {}
    with path.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            code = (row.get("code") or "").strip()
            if code:
                out[code] = row
    return out


def primary_icao(row: dict[str, str]) -> str:
    """Prefer formal ICAO, then GPS code, then ident."""
    for key in ("icao_code", "gps_code", "ident"):
        v = (row.get(key) or "").strip().upper()
        if v:
            return v
    return ""


def trim_iata(row: dict[str, str]) -> str:
    v = (row.get("iata_code") or "").strip().upper()
    return v if 2 <= len(v) <= 3 else ""


def merge_full(
    airports_path: Path,
    countries: dict[str, dict[str, str]],
    regions: dict[str, dict[str, str]],
    out_path: Path,
) -> int:
    extra_country = [
        "country_name",
        "country_wikipedia_link",
        "country_keywords",
    ]
    extra_region = [
        "region_name",
        "region_local_code",
        "region_wikipedia_link",
        "region_keywords",
    ]

    n = 0
    with airports_path.open(newline="", encoding="utf-8") as inf, out_path.open(
        "w", newline="", encoding="utf-8"
    ) as outf:
        reader = csv.DictReader(inf)
        if not reader.fieldnames:
            raise SystemExit("Empty airports CSV")
        fieldnames = list(reader.fieldnames) + extra_country + extra_region
        writer = csv.DictWriter(outf, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()

        for row in reader:
            cc = (row.get("iso_country") or "").strip()
            rc = (row.get("iso_region") or "").strip()

            c = countries.get(cc, {})
            row["country_name"] = (c.get("name") or "").strip()
            row["country_wikipedia_link"] = (c.get("wikipedia_link") or "").strip()
            row["country_keywords"] = (c.get("keywords") or "").strip()

            r = regions.get(rc, {})
            row["region_name"] = (r.get("name") or "").strip()
            row["region_local_code"] = (r.get("local_code") or "").strip()
            row["region_wikipedia_link"] = (r.get("wikipedia_link") or "").strip()
            row["region_keywords"] = (r.get("keywords") or "").strip()

            writer.writerow(row)
            n += 1

    return n


def merge_slim(
    airports_path: Path,
    countries: dict[str, dict[str, str]],
    regions: dict[str, dict[str, str]],
    out_path: Path,
) -> int:
    slim_fields = [
        "source_id",
        "icao",
        "iata",
        "name",
        "city",
        "country_iso2",
        "country_name",
        "region_code",
        "region_name",
        "latitude_deg",
        "longitude_deg",
        "elevation_ft",
        "airport_type",
        "scheduled_service",
        "continent",
    ]

    n = 0
    with airports_path.open(newline="", encoding="utf-8") as inf, out_path.open(
        "w", newline="", encoding="utf-8"
    ) as outf:
        reader = csv.DictReader(inf)
        writer = csv.DictWriter(outf, fieldnames=slim_fields)
        writer.writeheader()

        for row in reader:
            cc = (row.get("iso_country") or "").strip()
            rc = (row.get("iso_region") or "").strip()
            c = countries.get(cc, {})
            r = regions.get(rc, {})

            slim = {
                "source_id": (row.get("id") or "").strip(),
                "icao": primary_icao(row),
                "iata": trim_iata(row),
                "name": (row.get("name") or "").strip(),
                "city": (row.get("municipality") or "").strip(),
                "country_iso2": cc,
                "country_name": (c.get("name") or "").strip(),
                "region_code": rc,
                "region_name": (r.get("name") or "").strip(),
                "latitude_deg": (row.get("latitude_deg") or "").strip(),
                "longitude_deg": (row.get("longitude_deg") or "").strip(),
                "elevation_ft": (row.get("elevation_ft") or "").strip(),
                "airport_type": (row.get("type") or "").strip(),
                "scheduled_service": (row.get("scheduled_service") or "").strip(),
                "continent": (row.get("continent") or "").strip(),
            }
            writer.writerow(slim)
            n += 1

    return n


def main() -> None:
    argv = sys.argv[1:]
    slim = False
    if argv and argv[0] == "--slim":
        slim = True
        argv = argv[1:]

    if len(argv) < 3:
        print(
            "Usage: merge_ourairports_csv.py [--slim] airports.csv countries.csv regions.csv [output.csv]",
            file=sys.stderr,
        )
        sys.exit(1)

    airports_path = Path(argv[0]).expanduser().resolve()
    countries_path = Path(argv[1]).expanduser().resolve()
    regions_path = Path(argv[2]).expanduser().resolve()

    if len(argv) >= 4:
        out_path = Path(argv[3]).expanduser().resolve()
    elif slim:
        out_path = airports_path.parent / "airports_slim.csv"
    else:
        out_path = airports_path.parent / "airports_with_geo.csv"

    countries = load_countries(countries_path)
    regions = load_regions(regions_path)

    if slim:
        n = merge_slim(airports_path, countries, regions, out_path)
        kind = "slim"
    else:
        n = merge_full(airports_path, countries, regions, out_path)
        kind = "full"

    print(f"Wrote {n} rows ({kind}) → {out_path}")


if __name__ == "__main__":
    main()
