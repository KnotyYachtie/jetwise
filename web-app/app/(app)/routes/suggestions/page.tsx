"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { JwCard } from "@/components/JwCard";
import { api } from "@/lib/api-client";
import { usd } from "@/lib/format";

type FleetRow = {
  type: string;
  config: { y: number; j: number; f: number };
};

type SugRoute = {
  id: string;
  origin: string;
  destination: string;
  hub: string | null;
  status: string;
  distance: number;
  demand: { y: number; j: number; f: number };
  optimized: {
    total_profit_per_week: number;
    fleet_mix: FleetRow[];
    scheduling: { trips_per_week: number };
  };
};

function fleetMixLine(rows: FleetRow[]): string {
  const m = new Map<string, number>();
  for (const r of rows) {
    m.set(r.type, (m.get(r.type) ?? 0) + 1);
  }
  return [...m.entries()].map(([t, n]) => `${n}× ${t}`).join(" · ") || "—";
}

export default function RouteSuggestionsPage() {
  const [routes, setRoutes] = useState<SugRoute[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [pipelineBusy, setPipelineBusy] = useState(false);
  const [pipelineLog, setPipelineLog] = useState<string | null>(null);

  const load = useCallback(async () => {
    setListLoading(true);
    setErr(null);
    try {
      const j = await api<{ routes: SugRoute[] }>(
        `/api/routes?status=${encodeURIComponent("suggested")}`
      );
      const sorted = [...j.routes].sort(
        (a, b) => b.optimized.total_profit_per_week - a.optimized.total_profit_per_week
      );
      setRoutes(sorted);
    } catch (e) {
      setErr((e as Error).message);
      setRoutes([]);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  async function runPipeline() {
    setPipelineBusy(true);
    setPipelineLog(null);
    setErr(null);
    try {
      const res = await fetch("/api/pipeline/run", {
        method: "POST",
        credentials: "include",
      });
      const j = (await res.json()) as { ok?: boolean; log?: string; error?: string };
      setPipelineLog(j.log ?? "");
      if (!res.ok || !j.ok) {
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setPipelineBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white">Route suggestions</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Rows with status <span className="font-mono text-zinc-400">suggested</span> — ranked by modeled optimized
            weekly profit. Run the full pipeline locally (Polars + DB import) from here or{" "}
            <span className="font-mono text-xs text-cyan-400/90">npm run pipeline</span> in{" "}
            <span className="font-mono text-xs text-zinc-400">web-app/</span>.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={pipelineBusy || listLoading}
            onClick={() => void runPipeline()}
            className="rounded-xl border border-cyan-500/45 bg-cyan-500/15 px-4 py-2 text-sm font-semibold text-cyan-100 disabled:opacity-40"
          >
            {pipelineBusy ? "Running pipeline…" : "Generate suggestions"}
          </button>
          <Link
            href="/routes"
            className="text-sm font-semibold text-cyan-400 hover:text-cyan-300 hover:underline"
          >
            ← All routes
          </Link>
        </div>
      </div>

      {err ? <p className="text-sm text-orange-400">{err}</p> : null}

      {pipelineLog ? (
        <JwCard title="Last pipeline log" subtitle="stdout/stderr combined">
          <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-black/40 p-3 font-mono text-[11px] leading-relaxed text-zinc-400">
            {pipelineLog}
          </pre>
        </JwCard>
      ) : null}

      {listLoading ? (
        <div className="h-48 animate-pulse rounded-2xl bg-zinc-900/60 ring-1 ring-cyan-500/10" />
      ) : routes.length === 0 ? (
        <JwCard title="No suggestions yet" subtitle="Import pipeline">
          <p className="text-sm text-zinc-500">
            Click <strong className="text-zinc-400">Generate suggestions</strong> (runs{" "}
            <code className="text-zinc-400">run_pipeline.sh</code>: Parquet rebuild → hub CSV → ranked DB insert), or run{" "}
            <code className="text-zinc-400">npm run pipeline</code> from <code className="text-zinc-400">web-app/</code>.
          </p>
        </JwCard>
      ) : (
        <JwCard title={`${routes.length} suggested OD pairs`} subtitle="Optimized economics · weekly">
          <ul className="divide-y divide-zinc-800">
            {routes.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/routes/${r.id}`}
                  className="flex flex-col gap-2 py-4 transition hover:bg-white/[0.03] sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-1"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-base text-white">
                      {r.origin} → {r.destination}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      Hub {r.hub ?? "—"} · {Math.round(r.distance)} km · demand Y{r.demand.y} J{r.demand.j} F{r.demand.f}{" "}
                      · trips/wk ~{r.optimized.scheduling.trips_per_week}
                    </p>
                    <p className="mt-1 text-xs text-cyan-200/80">{fleetMixLine(r.optimized.fleet_mix)}</p>
                  </div>
                  <div className="shrink-0 text-left sm:text-right">
                    <p className="text-[10px] uppercase tracking-widest text-zinc-500">Optimized / wk</p>
                    <p className="font-mono text-lg text-emerald-400">{usd(r.optimized.total_profit_per_week)}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </JwCard>
      )}
    </div>
  );
}
