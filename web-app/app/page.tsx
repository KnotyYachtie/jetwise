"use client";

import React, { useState, useMemo } from "react";

// ---------- UI COMPONENTS ----------
const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl ${className}`}>
    {children}
  </div>
);

const Badge = ({ children }: { children: React.ReactNode }) => (
  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border bg-blue-500/10 text-blue-400 border-blue-500/20">
    {children}
  </span>
);

const StatLabel = ({ children }: { children: React.ReactNode }) => (
  <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">{children}</span>
);

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [routes, setRoutes] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [distance, setDistance] = useState("");
  const [demandY, setDemandY] = useState("");
  const [demandJ, setDemandJ] = useState("");
  const [demandF, setDemandF] = useState("");

  async function optimizeAll() {
    setLoading(true);
    setError(null);
    try {
      const dbRes = await fetch("/api/routes");
      const dbData = await dbRes.json();

      const res = await fetch("/api/optimize-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ routes: dbData.routes }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`API ${res.status}: ${text}`);
      }

      const data = await res.json();
      setRoutes(data.routes || []);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  const handleAddRoute = async () => {
    const dist = parseInt(distance);
    const y = parseInt(demandY) || 0;
    const j = parseInt(demandJ) || 0;
    const f = parseInt(demandF) || 0;

    if (!origin || !destination || !dist) return;

    await fetch("/api/routes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        origin,
        destination,
        distance: dist,
        demand_y: y,
        demand_j: j,
        demand_f: f,
      }),
    });

    setOrigin("");
    setDestination("");
    setDistance("");
    setDemandY("");
    setDemandJ("");
    setDemandF("");

    alert("Route saved");
  };

  const sortedRoutes = useMemo(() => {
    return [...routes].sort((a, b) => {
      const getBest = (r: any) =>
        r.optimized?.plan?.reduce((x: any, y: any) =>
          x.profit_per_hour > y.profit_per_hour ? x : y,
          { profit_per_hour: 0 }
        )?.profit_per_hour || 0;
      return getBest(b) - getBest(a);
    });
  }, [routes]);

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <div className="max-w-7xl mx-auto px-6 py-12">

        {/* HEADER */}
        <div className="flex justify-between items-end mb-10">
          <h1 className="text-4xl font-bold">JetWise Optimizer</h1>
          <button
            onClick={optimizeAll}
            disabled={loading}
            className="bg-white text-black px-6 py-3 rounded font-bold"
          >
            {loading ? "Optimizing..." : "Optimize"}
          </button>
        </div>

        {/* INPUT */}
        <Card className="mb-10">
          <div className="p-6 grid grid-cols-2 md:grid-cols-6 gap-4">
            <input value={origin} onChange={(e) => setOrigin(e.target.value.toUpperCase())} placeholder="Origin" className="bg-zinc-950 border border-zinc-800 p-2 rounded" />
            <input value={destination} onChange={(e) => setDestination(e.target.value.toUpperCase())} placeholder="Destination" className="bg-zinc-950 border border-zinc-800 p-2 rounded" />
            <input value={distance} onChange={(e) => setDistance(e.target.value)} placeholder="Distance" className="bg-zinc-950 border border-zinc-800 p-2 rounded" />
            <input value={demandY} onChange={(e) => setDemandY(e.target.value)} placeholder="Y" className="bg-zinc-950 border border-zinc-800 p-2 rounded" />
            <input value={demandJ} onChange={(e) => setDemandJ(e.target.value)} placeholder="J" className="bg-zinc-950 border border-zinc-800 p-2 rounded" />
            <input value={demandF} onChange={(e) => setDemandF(e.target.value)} placeholder="F" className="bg-zinc-950 border border-zinc-800 p-2 rounded" />
            <button onClick={handleAddRoute} className="col-span-2 md:col-span-6 bg-blue-600 p-2 rounded font-bold">Add Route</button>
          </div>
        </Card>

        {error && <div className="mb-6 text-red-400">{error}</div>}

        {/* RESULTS */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedRoutes.map((route) => (
            <Card key={route.id}>
              <div className="p-5 border-b border-zinc-800">
                <div className="flex justify-between">
                  <div>
                    <div className="font-bold text-lg">
                      {route.origin} → {route.destination}
                    </div>
                    <div className="text-xs text-zinc-500">{route.distance} km</div>
                  </div>
                </div>
              </div>

              <div className="p-5">
                {route.optimized?.total_profit_per_week && (
                  <div className="mb-4">
                    <StatLabel>Weekly Profit</StatLabel>
                    <div className="text-2xl font-bold">
                      ${route.optimized.total_profit_per_week.toLocaleString()}
                    </div>
                  </div>
                )}

                {route.optimized?.plan?.map((p: any, i: number) => (
                  <div key={i} className="mb-3 p-3 bg-zinc-950 rounded border border-zinc-800">
                    <div className="flex justify-between mb-1">
                      <Badge>{p.aircraft.name}</Badge>
                      <span className="text-xs">{p.trips_per_week || p.tpd * 7} trips/wk</span>
                    </div>
                    <div className="text-xs">
                      Y:{p.config.y} J:{p.config.j} F:{p.config.f}
                    </div>
                    <div className="text-green-400 text-sm">
                      ${p.profit_per_week.toLocaleString()} / wk
                    </div>
                  </div>
                ))}

                {route.optimized?.marginal_values && (
                  <div className="mt-4">
                    <StatLabel>Marginal Value</StatLabel>
                    {route.optimized.marginal_values.map((m: any, i: number) => (
                      <div key={i} className="text-sm">
                        {m.aircraft}: 
                        <span className={m.value > 0 ? "text-green-400" : "text-red-400"}>
                          ${Math.round(m.value).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
