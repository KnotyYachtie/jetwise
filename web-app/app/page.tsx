"use client";

import { useState } from "react";

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [routes, setRoutes] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [manualRoutes, setManualRoutes] = useState<any[]>([]);
  const [fleet, setFleet] = useState<any[]>([]);
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

  const sortedRoutes = [...routes].sort((a, b) => {
    const bestA = a.optimized?.plan?.reduce((x: any, y: any) =>
      x.profit_per_hour > y.profit_per_hour ? x : y
    );
    const bestB = b.optimized?.plan?.reduce((x: any, y: any) =>
      x.profit_per_hour > y.profit_per_hour ? x : y
    );

    const valA = bestA?.profit_per_hour || 0;
    const valB = bestB?.profit_per_hour || 0;

    return valB - valA; // highest first
  });
  return (
    <div className="min-h-screen bg-zinc-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">JetWise Optimizer</h1>

        <div className="mb-6 p-4 bg-white rounded shadow">
          <div className="font-semibold mb-2">Add Route</div>
          <div className="flex flex-wrap gap-2 mb-2">
            <input
              placeholder="Origin"
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              className="border p-2 rounded w-32"
            />
            <input
              placeholder="Destination"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className="border p-2 rounded w-32"
            />
            <input
              placeholder="Distance"
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
              className="border p-2 rounded w-28"
            />
            <input
              placeholder="Y"
              value={demandY}
              onChange={(e) => setDemandY(e.target.value)}
              className="border p-2 rounded w-20"
            />
            <input
              placeholder="J"
              value={demandJ}
              onChange={(e) => setDemandJ(e.target.value)}
              className="border p-2 rounded w-20"
            />
            <input
              placeholder="F"
              value={demandF}
              onChange={(e) => setDemandF(e.target.value)}
              className="border p-2 rounded w-20"
            />
            <button
              onClick={async () => {
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
              }}
              className="bg-blue-600 text-white px-4 rounded"
            >
              Add
            </button>
          </div>

          <div className="text-xs text-zinc-500">
            (Enter demand for Y / J / F to get meaningful optimization)
          </div>
        </div>

        <button
          onClick={optimizeAll}
          className="bg-black text-white px-6 py-3 rounded mb-6"
        >
          {loading ? "Optimizing..." : "Optimize All Routes"}
        </button>

        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {sortedRoutes.map((route) => (
            <div
              key={route.id}
              className={`bg-white p-4 rounded shadow border-l-4 ${
                (() => {
                  const best = route.optimized?.plan?.reduce((a: any, b: any) =>
                    a.profit_per_hour > b.profit_per_hour ? a : b
                  );
                  const val = best?.profit_per_hour || 0;

                  if (val > 400000) return "border-green-500";
                  if (val > 200000) return "border-yellow-400";
                  return "border-red-400";
                })()
              }`}
            >
              <div className="font-semibold">
                {route.origin} → {route.destination}
              </div>

              <div className="text-sm text-zinc-600">
                Distance: {route.distance} km
              </div>

              {route.optimized?.total_profit_per_week && (
                <div className="mt-2 text-green-600 font-medium">
                  Profit/week: $
                  {route.optimized.total_profit_per_week.toLocaleString()}
                </div>
              )}
              {(() => {
                const best = route.optimized?.plan?.reduce((a: any, b: any) =>
                  a.profit_per_hour > b.profit_per_hour ? a : b
                );
                const val = best?.profit_per_hour || 0;

                let label = "Weak";
                let color = "text-red-600";

                if (val > 400000) {
                  label = "Strong";
                  color = "text-green-600";
                } else if (val > 200000) {
                  label = "Decent";
                  color = "text-yellow-600";
                }

                return (
                  <div className={`text-sm font-medium ${color}`}>
                    Efficiency: {label}
                  </div>
                );
              })()}
              {/* Show best profit/hr if available */}
              {(() => {
                const best = route.optimized?.plan?.reduce((a: any, b: any) =>
                  a.profit_per_hour > b.profit_per_hour ? a : b
                );
                return best && (
                  <div className="text-blue-700 font-medium">
                    Best: ${Math.round(best.profit_per_hour).toLocaleString()} / hr
                  </div>
                );
              })()}

              {route.optimized?.plan?.map((p: any, i: number) => (
                <div key={i} className="mt-3 text-sm text-zinc-600 border-t pt-2">
                  <div className="font-medium">{p.aircraft.name}</div>
                  <div>Config → Y:{p.config.y} J:{p.config.j} F:{p.config.f}</div>
                  <div>{p.tpd} trips/day</div>
                  <div className="text-green-700">
                    ${p.profit_per_week.toLocaleString()} / week
                  </div>
                  <div className="text-blue-600">
                    ${Math.round(p.profit_per_hour).toLocaleString()} / hr
                  </div>
                </div>
              ))}
              {route.optimized?.marginal_values?.length > 0 && (
                <div className="mt-3 border-t pt-2">
                  <div className="font-medium text-sm mb-1">Marginal Value</div>
                  {route.optimized.marginal_values.map((m: any, i: number) => (
                    <div key={i} className="text-sm text-zinc-600">
                      {m.aircraft}: 
                      <span className={m.value > 0 ? "text-green-600" : "text-red-500"}>
                        ${Math.round(m.value).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
