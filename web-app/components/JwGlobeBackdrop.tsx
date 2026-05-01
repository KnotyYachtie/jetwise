"use client";

import dynamic from "next/dynamic";
import type { RouteMapDot } from "@/lib/route-map-dots";

const JwGlobeBackdropInner = dynamic(
  () => import("./JwGlobeBackdropInner").then((m) => m.JwGlobeBackdropInner),
  { ssr: false, loading: () => <div className="h-full w-full bg-black" aria-hidden /> }
);

export function JwGlobeBackdrop({ dots }: { dots: RouteMapDot[] }) {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[1] overflow-hidden">
      <div className="absolute inset-0 opacity-[0.48]">
        <JwGlobeBackdropInner arcs={dots} />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black via-transparent to-black opacity-[0.72]" />
    </div>
  );
}
