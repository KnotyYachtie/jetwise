"use client";

import dynamic from "next/dynamic";
import type { RouteMapDot } from "@/lib/route-map-dots";

const JwAceternityGlobeCanvas = dynamic(
  () => import("./JwAceternityGlobe").then((m) => m.JwAceternityGlobeCanvas),
  { ssr: false, loading: () => <div className="h-full w-full rounded-full bg-black/50" aria-hidden /> }
);

/**
 * Backdrop globe: Aceternity-style hex land + arcs, scaled down so the sphere
 * reads clearly (not edge-to-edge “flat” coverage).
 */
export function JwGlobeBackdrop({ dots }: { dots: RouteMapDot[] }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[1] flex items-center justify-center overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-b from-black via-transparent to-black opacity-[0.55]" />
      <div className="relative z-0 flex h-[min(72vh,640px)] w-[min(92vw,640px)] max-w-[min(92vw,640px)] items-center justify-center opacity-[0.58] sm:h-[min(76vh,700px)] sm:w-[min(88vw,700px)] sm:max-w-[700px]">
        <div className="aspect-[6/5] h-full max-h-full w-full max-w-full">
          <JwAceternityGlobeCanvas arcs={dots} />
        </div>
      </div>
    </div>
  );
}
