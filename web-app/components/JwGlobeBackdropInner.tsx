"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useEffect, useMemo, useState } from "react";
import R3fGlobe from "r3f-globe";
import { Fog } from "three";
import { JW_TOKENS } from "@/lib/jw-design-tokens";
import type { RouteMapDot } from "@/lib/route-map-dots";

/** Minimal GeoJSON Feature shape for `globe.json` (admin polygons). */
export type GlobeLandFeature = {
  type: "Feature";
  properties?: Record<string, unknown>;
  geometry: { type: string; coordinates: unknown };
};

const GLOBE_JSON_URL = "/globe/globe.json";
const GLOBE_IMAGE_URL = "/globe/earth-blue-marble.jpg";
const GLOBE_BUMP_URL = "/globe/earth-topology.png";

/**
 * Full-bleed 3D globe (three-globe + R3F).
 * - Earth texture + bump from `public/globe/` (three-globe example assets).
 * - Land admin boundaries from `public/globe/globe.json` (GeoJSON FeatureCollection).
 * - Route arcs use DB lat/lon via `arcs` (see `getRouteMapDots`).
 */
export function JwGlobeBackdropInner({ arcs }: { arcs: RouteMapDot[] }) {
  const [landFeatures, setLandFeatures] = useState<GlobeLandFeature[]>([]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      void fetch(GLOBE_JSON_URL)
        .then((r) => {
          if (!r.ok) throw new Error(String(r.status));
          return r.json() as Promise<{ type?: string; features?: GlobeLandFeature[] }>;
        })
        .then((d) => {
          if (cancelled || !Array.isArray(d.features)) return;
          setLandFeatures(d.features);
        })
        .catch(() => {
          /* Land overlay is optional; globe still renders with texture + arcs. */
        });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const arcsData = useMemo(
    () =>
      arcs.map((d) => ({
        startLat: d.start.lat,
        startLng: d.start.lng,
        endLat: d.end.lat,
        endLng: d.end.lng,
        color: JW_TOKENS.globe.arc,
      })),
    [arcs]
  );

  return (
    <Canvas
      className="h-full w-full touch-none"
      camera={{ position: [0, 0, 300], fov: 45 }}
      gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
      onCreated={({ scene }) => {
        scene.fog = new Fog(JW_TOKENS.globe.fog, 200, 2600);
      }}
    >
      <ambientLight intensity={0.62} color={JW_TOKENS.globe.ambient} />
      <directionalLight position={[400, 120, 400]} intensity={1.1} color={JW_TOKENS.globe.directional} />
      <directionalLight position={[-220, -40, -180]} intensity={0.28} color="#64748b" />
      <R3fGlobe
        globeImageUrl={GLOBE_IMAGE_URL}
        bumpImageUrl={GLOBE_BUMP_URL}
        polygonsData={landFeatures}
        polygonGeoJsonGeometry="geometry"
        polygonAltitude={0.0035}
        polygonCapColor={() => JW_TOKENS.globe.landCap}
        polygonSideColor={() => JW_TOKENS.globe.landSide}
        polygonStrokeColor={() => JW_TOKENS.globe.landStroke}
        arcsData={arcsData}
        arcStroke={0.38}
        arcCurveResolution={96}
        arcAltitude={0.08}
        arcDashLength={1}
        arcDashGap={0}
        arcDashAnimateTime={0}
        atmosphereColor={JW_TOKENS.accent}
        atmosphereAltitude={JW_TOKENS.globe.atmosphereAltitude}
        showAtmosphere
      />
      <OrbitControls
        enableZoom={false}
        enablePan={false}
        autoRotate
        autoRotateSpeed={0.28}
        minPolarAngle={Math.PI / 2.25}
        maxPolarAngle={Math.PI / 1.75}
      />
    </Canvas>
  );
}
