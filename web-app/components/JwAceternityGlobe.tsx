"use client";

/**
 * Aceternity “GitHub globe” pattern (three-globe + imperative ThreeGlobe + R3F Canvas).
 * Source: ui.aceternity.com manual install — adjusted for React 19 / Fiber 9, stable scene/camera,
 * numeric `arcStroke`, and safe `globeConfig` defaults.
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

const RING_PROPAGATION_SPEED = 3;
const ASPECT = 1.2;
const CAMERA_Z = 300;

export type Position = {
  order: number;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  arcAlt: number;
  color: string;
};

type ArcDatum = Omit<Position, "color"> & {
  color: (t: number) => string;
};

type RingDatum = {
  lat: number;
  lng: number;
  color: (t: number) => string;
};

export type GlobeConfig = {
  pointSize?: number;
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
  arcTime?: number;
  arcLength?: number;
  rings?: number;
  maxRings?: number;
  initialPosition?: { lat: number; lng: number };
  autoRotate?: boolean;
  autoRotateSpeed?: number;
};

interface WorldProps {
  globeConfig: GlobeConfig;
  data: Position[];
}

const DEFAULT_GLOBE: Required<
  Pick<
    GlobeConfig,
    | "pointSize"
    | "atmosphereColor"
    | "showAtmosphere"
    | "atmosphereAltitude"
    | "polygonColor"
    | "globeColor"
    | "emissive"
    | "emissiveIntensity"
    | "shininess"
    | "arcTime"
    | "arcLength"
    | "rings"
    | "maxRings"
    | "ambientLight"
    | "directionalLeftLight"
    | "directionalTopLight"
    | "pointLight"
  >
> = {
  pointSize: 1,
  atmosphereColor: "#ffffff",
  showAtmosphere: true,
  atmosphereAltitude: 0.1,
  polygonColor: "rgba(255,255,255,0.7)",
  globeColor: "#1d072e",
  emissive: "#000000",
  emissiveIntensity: 0.1,
  shininess: 0.9,
  arcTime: 2000,
  arcLength: 0.9,
  rings: 1,
  maxRings: 3,
  ambientLight: "#ffffff",
  directionalLeftLight: "#ffffff",
  directionalTopLight: "#ffffff",
  pointLight: "#ffffff",
};

function mergeGlobeConfig(g: GlobeConfig): typeof DEFAULT_GLOBE {
  return { ...DEFAULT_GLOBE, ...g };
}

function hexToRgb(hex: string) {
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  const normalized = hex.replace(shorthandRegex, (_m, r: string, g: string, b: string) => r + r + g + g + b + b);
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(normalized);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

function colorInterpolator(hex: string) {
  const rgb = hexToRgb(hex);
  if (!rgb) return (t: number) => `rgba(34, 211, 238, ${Math.max(0.06, 1 - t)})`;
  return (t: number) => `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${Math.max(0.06, 1 - t)})`;
}

function Globe({ globeConfig, data }: WorldProps) {
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
    if (!data?.length) {
      globeRef.current.arcsData([]).pointsData([]).ringsData([]);
      return;
    }

    const arcs: ArcDatum[] = data.map((arc) => ({
      ...arc,
      color: colorInterpolator(arc.color),
    }));
    const points: {
      size: number;
      order: number;
      color: string;
      lat: number;
      lng: number;
    }[] = [];
    for (let i = 0; i < arcs.length; i++) {
      const arc = arcs[i];
      points.push(
        { size: cfg.pointSize, order: arc.order, color: data[i]?.color ?? "#22d3ee", lat: arc.startLat, lng: arc.startLng },
        { size: cfg.pointSize, order: arc.order, color: data[i]?.color ?? "#22d3ee", lat: arc.endLat, lng: arc.endLng }
      );
    }

    const filteredPoints = points.filter(
      (v, i, a) =>
        a.findIndex((v2) => ["lat", "lng"].every((k) => v2[k as "lat" | "lng"] === v[k as "lat" | "lng"])) === i
    );

    globeRef.current
      .hexPolygonsData(countries.features)
      .hexPolygonResolution(3)
      .hexPolygonMargin(0.7)
      .showAtmosphere(cfg.showAtmosphere)
      .atmosphereColor(cfg.atmosphereColor)
      .atmosphereAltitude(cfg.atmosphereAltitude)
      .hexPolygonColor(() => cfg.polygonColor);

    globeRef.current
      .arcsData(arcs)
      .arcStartLat("startLat")
      .arcStartLng("startLng")
      .arcEndLat("endLat")
      .arcEndLng("endLng")
      .arcColor("color")
      .arcAltitude("arcAlt")
      .arcStroke(() => [0.28, 0.3, 0.32][Math.floor(Math.random() * 3)] as number)
      .arcDashLength(cfg.arcLength)
      .arcDashInitialGap("order")
      .arcDashGap(1.2)
      .arcDashAnimateTime(cfg.arcTime);

    globeRef.current
      .pointsData(filteredPoints)
      .pointColor("color")
      .pointsMerge(true)
      .pointAltitude(0.0)
      .pointRadius(2);

    globeRef.current
      .ringsData([])
      .ringColor("color")
      .ringMaxRadius(cfg.maxRings)
      .ringPropagationSpeed(RING_PROPAGATION_SPEED)
      .ringRepeatPeriod((cfg.arcTime * cfg.arcLength) / cfg.rings);
  }, [
    isInitialized,
    data,
    cfg.pointSize,
    cfg.showAtmosphere,
    cfg.atmosphereColor,
    cfg.atmosphereAltitude,
    cfg.polygonColor,
    cfg.arcLength,
    cfg.arcTime,
    cfg.rings,
    cfg.maxRings,
  ]);

  useEffect(() => {
    if (!globeRef.current || !isInitialized || !data?.length) return;

    const pushRings = () => {
      if (!globeRef.current) return;
      const activeCount = Math.max(1, Math.floor(data.length * 0.42));
      const newNumbersOfRings = genRandomNumbers(0, data.length, activeCount);
      const ringsData: RingDatum[] = data
        .filter((d, i) => newNumbersOfRings.includes(i))
        .map((d) => ({
          lat: d.startLat,
          lng: d.startLng,
          color: colorInterpolator(d.color),
        }));
      globeRef.current.ringsData(ringsData);
    };

    pushRings();
    const interval = setInterval(pushRings, 1400);

    return () => clearInterval(interval);
  }, [isInitialized, data]);

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
  const { globeConfig, data } = props;
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
      <Globe globeConfig={globeConfig} data={data} />
      <OrbitControls
        enablePan={false}
        enableZoom={false}
        minDistance={CAMERA_Z}
        maxDistance={CAMERA_Z}
        autoRotateSpeed={globeConfig.autoRotateSpeed ?? 0.35}
        autoRotate={globeConfig.autoRotate ?? true}
        minPolarAngle={Math.PI / 3.5}
        maxPolarAngle={Math.PI - Math.PI / 3}
      />
    </Canvas>
  );
}

function genRandomNumbers(min: number, max: number, count: number) {
  const arr: number[] = [];
  while (arr.length < count) {
    const r = Math.floor(Math.random() * (max - min)) + min;
    if (!arr.includes(r)) arr.push(r);
  }
  return arr;
}

const JETWISE_ACETERNITY_GLOBE: GlobeConfig = {
  pointSize: 1,
  atmosphereColor: "rgba(34, 211, 238, 0.45)",
  showAtmosphere: true,
  atmosphereAltitude: 0.14,
  polygonColor: "rgba(34, 211, 238, 0.22)",
  globeColor: "#0a1620",
  emissive: "#061820",
  emissiveIntensity: 0.22,
  shininess: 0.88,
  arcTime: 2800,
  arcLength: 0.92,
  rings: 1,
  maxRings: 3,
  ambientLight: "#b8c4d4",
  directionalLeftLight: "#a8c8f0",
  directionalTopLight: "#ffffff",
  pointLight: "#e0f4ff",
  autoRotate: true,
  autoRotateSpeed: 0.45,
};

export function JwAceternityGlobeCanvas({ arcs }: { arcs: RouteMapDot[] }) {
  const data: Position[] = useMemo(
    () =>
      arcs.map((d, i) => ({
        order: i,
        startLat: d.start.lat,
        startLng: d.start.lng,
        endLat: d.end.lat,
        endLng: d.end.lng,
        arcAlt: 0.14,
        color: "#22d3ee",
      })),
    [arcs]
  );

  return <World globeConfig={JETWISE_ACETERNITY_GLOBE} data={data} />;
}
