"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useMemo } from "react";
import R3fGlobe from "r3f-globe";
import { Color, Fog, MeshStandardMaterial } from "three";
import { JW_TOKENS } from "@/lib/jw-design-tokens";
import type { RouteMapDot } from "@/lib/route-map-dots";

/**
 * Full-bleed 3D globe (three-globe + R3F). Styling uses `JW_TOKENS` / `--jw-globe-*` design tokens.
 */
export function JwGlobeBackdropInner({ arcs }: { arcs: RouteMapDot[] }) {
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

  const globeMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        color: new Color(JW_TOKENS.globe.base),
        emissive: new Color(JW_TOKENS.globe.emissive),
        emissiveIntensity: JW_TOKENS.globe.emissiveIntensity,
        roughness: JW_TOKENS.globe.roughness,
        metalness: JW_TOKENS.globe.metalness,
      }),
    []
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
      <ambientLight intensity={0.5} color={JW_TOKENS.globe.ambient} />
      <directionalLight position={[400, 120, 400]} intensity={1.05} color={JW_TOKENS.globe.directional} />
      <directionalLight position={[-220, -40, -180]} intensity={0.32} color="#64748b" />
      <R3fGlobe
        globeMaterial={globeMaterial}
        arcsData={arcsData}
        arcDashLength={0.35}
        arcDashGap={1.25}
        arcDashAnimateTime={3200}
        arcAltitude={0.11}
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
