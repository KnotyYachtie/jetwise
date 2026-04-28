"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { JwCard } from "@/components/JwCard";
import { api } from "@/lib/api-client";
import { usd } from "@/lib/format";
import { formatHubLine } from "@/lib/hubs";

type HubRow = {
  icao: string;
  name: string;
  city: string;
  country: string;
  route_count: number;
  aircraft_count: number;
  hub_total_weekly_profit: number;
};

type Res = { hubs: HubRow[]; fleet_average_daily_asset_yield: number };

export default function HubsPage() {
  const [data, setData] = useState<Res | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api<Res>("/api/hubs")
      .then(setData)
      .catch((e: Error) => setErr(e.message));
  }, []);

  if (err) {
    return (
      <JwCard title="Hubs" subtitle="Error">
        <p className="text-sm text-orange-400">{err}</p>
      </JwCard>
    );
  }
  if (!data) {
    return <div className="h-40 animate-pulse rounded-2xl bg-zinc-900/60 ring-1 ring-cyan-500/10" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-white">Hub matrix</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Fleet average daily asset yield:{" "}
          <span className="font-mono text-cyan-200">{usd(data.fleet_average_daily_asset_yield)}</span>
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {data.hubs.map((h) => (
          <Link key={h.icao} href={`/hubs/${h.icao}`}>
            <JwCard title={formatHubLine({ icao: h.icao, name: h.name, city: h.city, country: h.country })}>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-[10px] uppercase tracking-widest text-zinc-500">Routes</dt>
                  <dd className="font-mono text-white">{h.route_count}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-widest text-zinc-500">Aircraft</dt>
                  <dd className="font-mono text-white">{h.aircraft_count}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-[10px] uppercase tracking-widest text-zinc-500">Weekly profit</dt>
                  <dd className="font-mono text-cyan-200">{usd(h.hub_total_weekly_profit)}</dd>
                </div>
              </dl>
            </JwCard>
          </Link>
        ))}
      </div>
    </div>
  );
}
