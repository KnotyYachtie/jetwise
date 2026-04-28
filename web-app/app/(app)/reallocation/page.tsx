"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { JwCard } from "@/components/JwCard";
import { api } from "@/lib/api-client";
import { usd } from "@/lib/format";

type Sug = {
  from_route: string;
  to_route: string;
  from_label: string;
  to_label: string;
  aircraft_type: string;
  current_contribution: number;
  potential_gain: number;
  net_fleet_gain: number;
  confidence: string;
};

export default function ReallocationPage() {
  const [items, setItems] = useState<Sug[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api<{ suggestions: Sug[] }>("/api/fleet/reallocation")
      .then((j) => setItems(j.suggestions))
      .catch((e: Error) => setErr(e.message));
  }, []);

  if (err) {
    return (
      <JwCard title="Reallocation" subtitle="Error">
        <p className="text-sm text-orange-400">{err}</p>
      </JwCard>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-white">Reallocation</h1>
        <p className="mt-1 text-sm text-zinc-500">Marginal gain vs underused secondaries (heuristic v1).</p>
      </div>

      <div className="space-y-3">
        {items.length ? (
          items.map((s) => (
            <div
              key={`${s.from_route}-${s.to_route}-${s.aircraft_type}`}
              className="rounded-2xl border border-cyan-500/20 bg-zinc-950/50 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs uppercase tracking-widest text-zinc-500">
                  {s.aircraft_type} · {s.confidence}
                </p>
                <p className="font-mono text-lg text-emerald-300">+{usd(s.net_fleet_gain)}/wk</p>
              </div>
              <p className="mt-2 text-sm text-zinc-300">
                Move from <span className="text-cyan-200">{s.from_label}</span> (
                {usd(s.current_contribution)}/wk) → <span className="text-cyan-200">{s.to_label}</span> (+
                {usd(s.potential_gain)}/wk marginal)
              </p>
              <div className="mt-3 flex flex-wrap gap-3 text-xs">
                <Link className="text-cyan-400 hover:underline" href={`/routes/${s.from_route}`}>
                  Open source
                </Link>
                <Link className="text-cyan-400 hover:underline" href={`/routes/${s.to_route}`}>
                  Open target
                </Link>
              </div>
            </div>
          ))
        ) : (
          <JwCard title="All clear" subtitle="No positive net swaps at the moment">
            <p className="text-sm text-zinc-500">Add more multi-aircraft routes or revisit hubs.</p>
          </JwCard>
        )}
      </div>
    </div>
  );
}
