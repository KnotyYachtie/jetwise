"use client";

import { efficiencyRingColor, revenueEfficiencyPercent } from "@/lib/revenue-efficiency";

const R = 40;
const STROKE = 5;
const CIRC = 2 * Math.PI * R;

type Props = {
  currentWeekly: number;
  optimizedWeekly: number;
  /** Accessible label, e.g. "KMIA to FYWH revenue efficiency" */
  label: string;
};

export function RouteRevenueEfficiencyRing({ currentWeekly, optimizedWeekly, label }: Props) {
  const pct = revenueEfficiencyPercent(currentWeekly, optimizedWeekly);
  const stroke = efficiencyRingColor(pct);
  const offset = CIRC * (1 - pct / 100);
  const display = `${Math.round(pct)}%`;

  return (
    <div
      role="img"
      aria-label={`${label}: ${display} of optimized weekly revenue`}
      className="flex shrink-0 flex-col items-center gap-1"
    >
      <svg width={96} height={96} viewBox="0 0 96 96" className="drop-shadow-[0_0_10px_rgba(34,211,238,0.25)]" aria-hidden>
        <circle cx={48} cy={48} r={R} fill="none" stroke="rgba(39, 39, 42, 0.85)" strokeWidth={STROKE} />
        <circle
          cx={48}
          cy={48}
          r={R}
          fill="none"
          stroke={stroke}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={offset}
          transform="rotate(-90 48 48)"
          style={{ transition: "stroke-dashoffset 0.35s ease, stroke 0.35s ease" }}
        />
      </svg>
      <span className="font-mono text-sm font-semibold text-zinc-100">{display}</span>
      <span className="text-[9px] uppercase tracking-widest text-zinc-500">vs opt. rev.</span>
    </div>
  );
}
