"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { JwCard } from "@/components/JwCard";
import { api } from "@/lib/api-client";
import { usdAbbrev } from "@/lib/format";

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
    scheduling: { trips_per_week: number };
  };
};

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
        <JwCard title={`${routes.length} ideas`} subtitle="Modeled profit / week · tap for economics">
          <ul className="divide-y divide-zinc-800">
            {routes.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/routes/${r.id}`}
                  className="-mx-1 flex min-h-[4.25rem] flex-col gap-1 rounded-xl px-3 py-4 transition active:bg-white/[0.06] sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:py-4 sm:hover:bg-white/[0.03]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-lg font-semibold tracking-tight text-white sm:text-base">
                      {r.origin} → {r.destination}
                    </p>
                    <p className="mt-1 text-[13px] leading-snug text-zinc-500">
                      {r.hub ?? "— hub"} · {Math.round(r.distance)} km · ~{r.optimized.scheduling.trips_per_week} trips/wk
                      <span className="text-zinc-600"> · </span>
                      <span className="text-zinc-400">
                        Y{r.demand.y} J{r.demand.j} F{r.demand.f}
                      </span>
                    </p>
                  </div>
                  <div className="shrink-0 border-t border-zinc-800/80 pt-3 sm:border-t-0 sm:pt-0 sm:text-right">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Profit / wk</p>
                    <p className="font-mono text-xl tabular-nums text-emerald-400 sm:text-lg">
                      {usdAbbrev(r.optimized.total_profit_per_week)}
                    </p>
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
