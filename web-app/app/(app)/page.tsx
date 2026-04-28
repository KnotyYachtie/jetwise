"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { JwCard } from "@/components/JwCard";
import { api } from "@/lib/api-client";
import { usd } from "@/lib/format";

type FleetRes = {
  summary: {
    fleet_total_weekly_profit: number;
    fleet_optimized_weekly_profit_total: number;
    aircraft_count: number;
    route_count: number;
    fleet_average_daily_asset_yield: number;
    routes_below_fleet_average: number;
    reallocation_opportunity_count: number;
  };
};

export default function FleetDashboardPage() {
  const [data, setData] = useState<FleetRes | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api<FleetRes>("/api/fleet")
      .then(setData)
      .catch((e: Error) => setErr(e.message));
  }, []);

  if (err) {
    return (
      <JwCard title="Fleet link failed" subtitle="Check Postgres connection and schema">
        <p className="text-sm text-orange-400">{err}</p>
      </JwCard>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <div className="h-40 animate-pulse rounded-2xl bg-zinc-900/80 ring-1 ring-cyan-500/15" />
      </div>
    );
  }

  const s = data.summary;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-white">Fleet dashboard</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-400">
          Backbone-aligned fleet totals and routing economics — REALISM fuel and CI modeling.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric title="Weekly profit (current)" value={usd(s.fleet_total_weekly_profit)} accent />
        <Metric title="Weekly profit (optimized sum)" value={usd(s.fleet_optimized_weekly_profit_total)} />
        <Metric title="Aircraft deployed" value={String(s.aircraft_count)} />
        <Metric title="Routes tracked" value={String(s.route_count)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <JwCard title="Yield & signals" subtitle="Daily asset yield drives redeployment decisions">
          <dl className="grid gap-4 text-sm">
            <Row label="Fleet avg daily asset yield" value={usd(s.fleet_average_daily_asset_yield)} />
            <Row label="Routes below fleet avg yield" value={String(s.routes_below_fleet_average)} />
            <Row
              label="Reallocation opportunities"
              value={
                <Link href="/reallocation" className="text-cyan-300 underline-offset-4 hover:underline">
                  {s.reallocation_opportunity_count}
                </Link>
              }
            />
          </dl>
        </JwCard>

        <JwCard title="Shortcuts" subtitle="Navigate hub lanes and routes">
          <div className="flex flex-wrap gap-3">
            <Shortcut href="/routes">Route pipeline</Shortcut>
            <Shortcut href="/hubs">Hub matrix</Shortcut>
            <Shortcut href="/reallocation">Reallocate</Shortcut>
            <Shortcut href="/settings">Markets &amp; CI</Shortcut>
          </div>
        </JwCard>
      </div>
    </div>
  );
}

function Metric({ title, value, accent }: { title: string; value: string; accent?: boolean }) {
  return (
    <div
      className={
        accent
          ? "rounded-2xl border border-cyan-500/30 bg-cyan-500/5 p-4 ring-1 ring-cyan-500/20"
          : "rounded-2xl border border-zinc-800 bg-zinc-950/50 p-4"
      }
    >
      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-zinc-800/80 py-2 last:border-0">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="font-mono text-cyan-200/90">{value}</dd>
    </div>
  );
}

function Shortcut({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-cyan-500/25 bg-black/40 px-4 py-2 text-sm text-cyan-200 transition hover:border-cyan-400/60 hover:shadow-[0_0_20px_rgba(34,211,238,0.2)]"
    >
      {children}
    </Link>
  );
}
