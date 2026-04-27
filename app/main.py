import argparse

from route_manager import (
    add_route,
    optimize_all,
    print_top_routes,
    print_route_detail
)
from optimizer import Aircraft, Company

# -----------------------------
# CONFIG (TEMP - replace later with DB/API)
# -----------------------------

def get_company():
    return Company(
        fuel_price=500,
        co2_price=120,
        fuel_training=100,
        co2_training=100,
        repair_training=100,
        load=1.0,
        ci=200
    )


def get_aircraft():
    a380 = Aircraft(
        name="A380",
        capacity=600,
        speed=1049,
        fuel=22.26,
        co2=0.16,
        check_cost=12937770,
        maintenance_interval=450,
        purchase_cost=215629503
    )

    a330 = Aircraft(
        name="A330",
        capacity=406,
        speed=801,
        fuel=12.0,
        co2=0.15,
        check_cost=3423028,
        maintenance_interval=510,
        purchase_cost=85235684
    )

    return [a380, a330]


# -----------------------------
# COMMANDS
# -----------------------------

def cmd_optimize_all(args):
    company = get_company()
    aircraft = get_aircraft()

    print("Optimizing all routes...")
    optimize_all(aircraft, company)
    print("Done.\n")


def cmd_top(args):
    print_top_routes(args.n)


def cmd_route(args):
    print_route_detail(args.id)


def cmd_add_sample(args):
    route = {
        "id": args.id,
        "origin": args.origin,
        "destination": args.destination,
        "distance": args.distance,
        "demand": {"y": args.y, "j": args.j, "f": args.f},
        "current": {"profit_per_day": args.current_profit},
        "optimized": {},
        "status": "active"
    }

    add_route(route)
    print(f"Added route {args.id}")


# -----------------------------
# CLI SETUP
# -----------------------------

def main():
    parser = argparse.ArgumentParser(description="Jetwise Route Optimizer")

    subparsers = parser.add_subparsers(dest="command")

    # optimize all
    p_opt = subparsers.add_parser("optimize", help="Optimize all routes")
    p_opt.set_defaults(func=cmd_optimize_all)

    # top routes
    p_top = subparsers.add_parser("top", help="Show top routes by delta")
    p_top.add_argument("-n", type=int, default=5)
    p_top.set_defaults(func=cmd_top)

    # route detail
    p_route = subparsers.add_parser("route", help="Show route detail")
    p_route.add_argument("id", type=str)
    p_route.set_defaults(func=cmd_route)

    # add route
    p_add = subparsers.add_parser("add", help="Add a route manually")
    p_add.add_argument("id", type=str)
    p_add.add_argument("origin", type=str)
    p_add.add_argument("destination", type=str)
    p_add.add_argument("distance", type=float)
    p_add.add_argument("y", type=int)
    p_add.add_argument("j", type=int)
    p_add.add_argument("f", type=int)
    p_add.add_argument("--current_profit", type=float, default=0)
    p_add.set_defaults(func=cmd_add_sample)

    args = parser.parse_args()

    if not hasattr(args, "func"):
        parser.print_help()
        return

    args.func(args)


if __name__ == "__main__":
    main()
