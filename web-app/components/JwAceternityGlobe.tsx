"use client";

/**
 * Aceternity-style globe shell: three-globe hex land + atmosphere, slow auto-rotate.
 * Route arcs, endpoint dots, and pulse rings are disabled (empty layers).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Color, Fog, Group, PerspectiveCamera, Scene, Vector3 } from "three";
import ThreeGlobe from "three-globe";
import { Canvas, extend, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import countries from "@/data/globe.json";
import type { RouteMapDot } from "@/lib/route-map-dots";

declare module "@react-three/fiber" {
  interface ThreeElements {
    threeGlobe: ThreeElements["mesh"] & { new (): ThreeGlobe };
  }
}

extend({ ThreeGlobe: ThreeGlobe });

const ASPECT = 1.2;
const CAMERA_Z = 300;

export type GlobeConfig = {
  globeColor?: string;
  showAtmosphere?: boolean;
  atmosphereColor?: string;
  atmosphereAltitude?: number;
  emissive?: string;
  emissiveIntensity?: number;
  shininess?: number;
  polygonColor?: string;
  ambientLight?: string;
  directionalLeftLight?: string;
  directionalTopLight?: string;
  pointLight?: string;
  autoRotate?: boolean;
  autoRotateSpeed?: number;
};

interface WorldProps {
  globeConfig: GlobeConfig;
}

const DEFAULT_GLOBE: Required<
  Pick<
    GlobeConfig,
    | "atmosphereColor"
    | "showAtmosphere"
    | "atmosphereAltitude"
    | "polygonColor"
    | "globeColor"
    | "emissive"
    | "emissiveIntensity"
    | "shininess"
    | "ambientLight"
    | "directionalLeftLight"
    | "directionalTopLight"
    | "pointLight"
  >
> = {
  atmosphereColor: "#ffffff",
  showAtmosphere: true,
  atmosphereAltitude: 0.1,
  polygonColor: "rgba(255,255,255,0.7)",
  globeColor: "#1d072e",
  emissive: "#000000",
  emissiveIntensity: 0.1,
  shininess: 0.9,
  ambientLight: "#ffffff",
  directionalLeftLight: "#ffffff",
  directionalTopLight: "#ffffff",
  pointLight: "#ffffff",
};

function mergeGlobeConfig(g: GlobeConfig): typeof DEFAULT_GLOBE {
  return { ...DEFAULT_GLOBE, ...g };
}

function Globe({ globeConfig }: WorldProps) {
  const globeRef = useRef<ThreeGlobe | null>(null);
  const groupRef = useRef<Group>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const cfg = useMemo(() => mergeGlobeConfig(globeConfig), [globeConfig]);

  useEffect(() => {
    if (!globeRef.current && groupRef.current) {
      globeRef.current = new ThreeGlobe();
      groupRef.current.add(globeRef.current);
      queueMicrotask(() => setIsInitialized(true));
    }
  }, []);

  useEffect(() => {
    if (!globeRef.current || !isInitialized) return;
    const globeMaterial = globeRef.current.globeMaterial() as unknown as {
      color: Color;
      emissive: Color;
      emissiveIntensity: number;
      shininess: number;
    };
    globeMaterial.color = new Color(cfg.globeColor);
    globeMaterial.emissive = new Color(cfg.emissive);
    globeMaterial.emissiveIntensity = cfg.emissiveIntensity;
    globeMaterial.shininess = cfg.shininess;
  }, [isInitialized, cfg.globeColor, cfg.emissive, cfg.emissiveIntensity, cfg.shininess]);

  useEffect(() => {
    if (!globeRef.current || !isInitialized) return;
    const g = globeRef.current;
    g.hexPolygonsData(countries.features)
      .hexPolygonResolution(3)
      .hexPolygonMargin(0.7)
      .showAtmosphere(cfg.showAtmosphere)
      .atmosphereColor(cfg.atmosphereColor)
      .atmosphereAltitude(cfg.atmosphereAltitude)
      .hexPolygonColor(() => cfg.polygonColor);
    g.arcsData([]).pointsData([]).ringsData([]);
  }, [isInitialized, cfg.showAtmosphere, cfg.atmosphereColor, cfg.atmosphereAltitude, cfg.polygonColor]);

  return <group ref={groupRef} />;
}

function WebGLRendererConfig() {
  const { gl, size } = useThree();

  useEffect(() => {
    gl.setPixelRatio(Math.min(2, typeof window !== "undefined" ? window.devicePixelRatio : 1));
    gl.setSize(size.width, size.height);
    gl.setClearColor(0x000000, 0);
  }, [gl, size]);

  return null;
}

export function World(props: WorldProps) {
  const { globeConfig } = props;
  const cfg = useMemo(() => mergeGlobeConfig(globeConfig), [globeConfig]);
  const scene = useMemo(() => {
    const s = new Scene();
    s.fog = new Fog(0x000000, 400, 2000);
    return s;
  }, []);
  const camera = useMemo(() => {
    const c = new PerspectiveCamera(50, ASPECT, 180, 1800);
    c.position.z = CAMERA_Z;
    return c;
  }, []);

  return (
    <Canvas scene={scene} camera={camera} className="h-full w-full" gl={{ alpha: true, antialias: true }}>
      <WebGLRendererConfig />
      <ambientLight color={cfg.ambientLight} intensity={0.6} />
      <directionalLight color={cfg.directionalLeftLight} position={new Vector3(-400, 100, 400)} />
      <directionalLight color={cfg.directionalTopLight} position={new Vector3(-200, 500, 200)} />
      <pointLight color={cfg.pointLight} position={new Vector3(-200, 500, 200)} intensity={0.8} />
      <Globe globeConfig={globeConfig} />
      <OrbitControls
        enablePan={false}
        enableZoom={false}
        minDistance={CAMERA_Z}
        maxDistance={CAMERA_Z}
        autoRotateSpeed={globeConfig.autoRotateSpeed ?? 0.12}
        autoRotate={globeConfig.autoRotate ?? true}
        minPolarAngle={Math.PI / 3.5}
        maxPolarAngle={Math.PI - Math.PI / 3}
      />
    </Canvas>
  );
}

const JETWISE_ACETERNITY_GLOBE: GlobeConfig = {
  atmosphereColor: "rgba(34, 211, 238, 0.45)",
  showAtmosphere: true,
  atmosphereAltitude: 0.14,
  polygonColor: "rgba(34, 211, 238, 0.22)",
  globeColor: "#0a1620",
  emissive: "#061820",
  emissiveIntensity: 0.22,
  shininess: 0.88,
  ambientLight: "#b8c4d4",
  directionalLeftLight: "#a8c8f0",
  directionalTopLight: "#ffffff",
  pointLight: "#e0f4ff",
  autoRotate: true,
  autoRotateSpeed: 0.12,
};

/** Route dots are accepted for API compatibility with the backdrop; they are not rendered. */
export function JwAceternityGlobeCanvas({ arcs }: { arcs: RouteMapDot[] }) {
  void arcs;
  return <World globeConfig={JETWISE_ACETERNITY_GLOBE} />;
}
