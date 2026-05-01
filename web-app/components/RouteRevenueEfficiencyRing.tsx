"use client";

import { efficiencyRingColor, revenueEfficiencyPercent } from "@/lib/revenue-efficiency";

const R = 40;
const STROKE = 5;
const CIRC = 2 * Math.PI * R;
const SIZE = 96;

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
      className="relative inline-flex shrink-0"
      style={{ width: SIZE, height: SIZE }}
    >
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="drop-shadow-[0_0_10px_rgba(34,211,238,0.25)]"
        aria-hidden
      >
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
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5 px-2 text-center">
        <span className="font-mono text-sm font-semibold leading-none text-zinc-100">{display}</span>
        <span className="max-w-[4.5rem] text-[8px] font-medium uppercase leading-tight tracking-wider text-zinc-500">
          vs opt. rev.
        </span>
      </div>
    </div>
  );
}
