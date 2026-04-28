"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { JwCard } from "@/components/JwCard";
import { api } from "@/lib/api-client";
import { usd } from "@/lib/format";
import { formatHubLine } from "@/lib/hubs";

type HubDetail = {
  hub: { icao: string; name: string; city: string; country: string };
  routes: { id: string; origin: string; destination: string; current: { weekly_profit_per_week?: number } }[];
  aircraft_count: number;
  hub_total_weekly_profit: number;
  hub_average_daily_asset_yield: number;
  fleet_average_daily_asset_yield: number;
  vs_fleet_daily_yield_delta: number;
};

export default function HubDetailPage() {
  const params = useParams();
  const icao = String(params.icao);
  const [data, setData] = useState<HubDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api<HubDetail>(`/api/hubs/${encodeURIComponent(icao)}`)
      .then(setData)
      .catch((e: Error) => setErr(e.message));
  }, [icao]);

  if (err) {
    return (
      <JwCard title="Hub" subtitle="Error">
        <p className="text-sm text-orange-400">{err}</p>
        <Link href="/hubs" className="mt-4 block text-sm text-cyan-300 hover:underline">
          ← All hubs
        </Link>
      </JwCard>
    );
  }
  if (!data) {
    return <div className="h-40 animate-pulse rounded-2xl bg-zinc-900/60 ring-1 ring-cyan-500/10" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/hubs" className="text-xs text-cyan-400 hover:underline">
          ← Hubs
        </Link>
        <h1 className="mt-2 text-3xl font-semibold text-white">
          {formatHubLine(data.hub)}
        </h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Metric label="Hub weekly profit" value={usd(data.hub_total_weekly_profit)} highlight />
        <Metric label="Aircraft staged" value={String(data.aircraft_count)} />
        <Metric label="Hub daily asset yield" value={usd(data.hub_average_daily_asset_yield)} />
        <Metric label="Δ vs fleet daily yield" value={usd(data.vs_fleet_daily_yield_delta)} />
      </div>

      <JwCard title="Routes" subtitle="Operating from this hub">
        <ul className="space-y-2 text-sm">
          {data.routes.length ? (
            data.routes.map((r) => (
              <li key={r.id} className="flex justify-between rounded-lg border border-zinc-800 bg-black/30 px-3 py-2">
                <Link href={`/routes/${r.id}`} className="font-mono text-cyan-200 hover:underline">
                  {r.origin} → {r.destination}
                </Link>
                <span className="font-mono text-zinc-400">{usd(r.current?.weekly_profit_per_week ?? 0)}</span>
              </li>
            ))
          ) : (
            <p className="text-sm text-zinc-500">No routes tagged to this hub</p>
          )}
        </ul>
      </JwCard>
    </div>
  );
}

function Metric({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className={
        highlight
          ? "rounded-2xl border border-cyan-500/25 bg-cyan-500/5 p-4"
          : "rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4"
      }
    >
      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{label}</p>
      <p className="mt-1 font-mono text-lg text-white">{value}</p>
    </div>
  );
}
