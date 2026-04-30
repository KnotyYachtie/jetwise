"use client";

import WorldMap from "@/components/ui/world-map";
import type { RouteMapDot } from "@/lib/route-map-dots";

const LINE = "#22d3ee";

export function JwRouteWorldMapBackdrop({ dots }: { dots: RouteMapDot[] }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[1] overflow-hidden"
    >
      <div className="absolute left-1/2 top-[42%] h-[min(78vh,640px)] w-[min(140vw,1280px)] -translate-x-1/2 -translate-y-1/2 opacity-[0.42]">
        <WorldMap
          dots={dots}
          lineColor={LINE}
          containerClassName="aspect-[2/1] h-full min-h-0 w-full rounded-none border-0 bg-black shadow-none"
        />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black via-transparent to-black opacity-70" />
    </div>
  );
}
