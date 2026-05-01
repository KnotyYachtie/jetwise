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
    <div className="flex w-full max-w-full flex-1 flex-col gap-6">
      {/* Header + actions row (Auto Layout: hug / fill) */}
      <header className="flex w-full flex-col gap-4 md:flex-row md:items-start md:justify-between md:gap-6">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <h1 className="w-fit text-3xl font-semibold tracking-tight text-white">Route suggestions</h1>
          <p className="max-w-prose text-sm leading-relaxed text-zinc-500">
            Rows with status <span className="font-mono text-zinc-400">suggested</span> — ranked by modeled optimized
            weekly profit. Run the full pipeline locally (Polars + DB import) from here or{" "}
            <span className="font-mono text-xs text-cyan-400/90">npm run pipeline</span> in{" "}
            <span className="font-mono text-xs text-zinc-400">web-app/</span>.
          </p>
        </div>
        <div className="flex w-full shrink-0 flex-col gap-3 md:w-auto md:min-w-fit md:flex-row md:items-center md:justify-end">
          <button
            type="button"
            disabled={pipelineBusy || listLoading}
            onClick={() => void runPipeline()}
            className="w-full min-h-11 rounded-xl border border-cyan-500/35 bg-cyan-500/12 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/18 disabled:opacity-40 md:w-auto md:px-5"
          >
            {pipelineBusy ? "Running pipeline…" : "Generate suggestions"}
          </button>
          <Link
            href="/routes"
            className="inline-flex w-full min-h-11 items-center justify-center rounded-xl border border-transparent px-4 py-3 text-center text-sm font-semibold text-cyan-400 transition hover:border-white/10 hover:bg-white/[0.04] hover:text-cyan-300 md:w-fit md:min-h-0 md:px-3 md:py-2"
          >
            ← All routes
          </Link>
        </div>
      </header>

      {err ? (
        <p className="w-full text-sm leading-relaxed text-orange-400" role="alert">
          {err}
        </p>
      ) : null}

      {pipelineLog ? (
        <JwCard title="Last pipeline log" subtitle="stdout/stderr combined">
          <div className="w-full overflow-x-auto overflow-y-auto rounded-xl border border-white/[0.06] bg-black/30">
            <pre className="w-max min-w-full max-h-[min(50vh,20rem)] whitespace-pre-wrap p-4 font-mono text-[11px] leading-relaxed text-zinc-400">
              {pipelineLog}
            </pre>
          </div>
        </JwCard>
      ) : null}

      {listLoading ? (
        <div
          className="flex w-full flex-col gap-4 rounded-2xl border border-white/[0.08] bg-zinc-950/50 p-6 backdrop-blur-sm"
          aria-hidden
        >
          <div className="flex flex-col gap-2">
            <div className="h-6 w-44 animate-pulse rounded-md bg-zinc-800/70" />
            <div className="h-4 w-full max-w-lg animate-pulse rounded-md bg-zinc-800/40" />
          </div>
          <div className="flex flex-col gap-3 pt-2">
            <div className="h-14 w-full animate-pulse rounded-xl bg-zinc-800/35" />
            <div className="h-14 w-full animate-pulse rounded-xl bg-zinc-800/30" />
            <div className="h-14 w-full animate-pulse rounded-xl bg-zinc-800/25" />
          </div>
        </div>
      ) : routes.length === 0 ? (
        <JwCard title="No suggestions yet" subtitle="Import pipeline">
          <p className="max-w-prose text-sm leading-relaxed text-zinc-500">
            Click <strong className="text-zinc-400">Generate suggestions</strong> (runs{" "}
            <code className="text-zinc-400">run_pipeline.sh</code>: Parquet rebuild → hub CSV → ranked DB insert), or run{" "}
            <code className="text-zinc-400">npm run pipeline</code> from <code className="text-zinc-400">web-app/</code>.
          </p>
        </JwCard>
      ) : (
        <JwCard title={`${routes.length} ideas`} subtitle="Modeled profit / week · tap for economics">
          {/* Scroll surface mimics wide table without clipping row content */}
          <div className="-mx-4 w-[calc(100%+2rem)] max-w-none overflow-x-auto overscroll-x-contain px-4 md:mx-0 md:w-full md:overflow-visible md:px-0">
            <div className="flex min-w-[min(100%,20rem)] flex-col rounded-xl border border-white/[0.06] md:min-w-0">
              {/* Column labels — desktop only (mobile repeats label per row; avoids empty chrome) */}
              <div className="hidden border-b border-white/[0.06] px-6 py-4 md:flex md:flex-row md:items-end md:justify-between md:gap-6">
                <span className="min-w-0 flex-1 text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">
                  Pair
                </span>
                <span className="w-36 shrink-0 text-right text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">
                  Profit / wk
                </span>
              </div>

              <ul className="flex flex-col">
                {routes.map((r) => (
                  <li key={r.id} className="border-b border-white/[0.06] last:border-b-0">
                    <Link
                      href={`/routes/${r.id}`}
                      className="flex w-full flex-col gap-3 px-4 py-4 transition-colors hover:bg-white/[0.03] active:bg-white/[0.06] md:flex-row md:items-center md:justify-between md:gap-6 md:px-6 md:py-4"
                    >
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <p className="w-fit font-mono text-lg font-semibold tracking-tight text-white md:text-base">
                          {r.origin} → {r.destination}
                        </p>
                        <p className="max-w-prose text-[13px] leading-snug text-zinc-500">
                          {r.hub ?? "— hub"} · {Math.round(r.distance)} km · ~{r.optimized.scheduling.trips_per_week}{" "}
                          trips/wk
                          <span className="text-zinc-600"> · </span>
                          <span className="text-zinc-400">
                            Y{r.demand.y} J{r.demand.j} F{r.demand.f}
                          </span>
                        </p>
                      </div>
                      <div className="flex w-full shrink-0 flex-col gap-1 border-t border-white/[0.06] pt-3 md:w-36 md:border-t-0 md:justify-center md:pt-0 md:text-right">
                        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500 md:hidden">
                          Profit / wk
                        </p>
                        <p className="font-mono text-xl tabular-nums text-emerald-400 md:text-lg">
                          {usdAbbrev(r.optimized.total_profit_per_week)}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </JwCard>
      )}
    </div>
  );
}
