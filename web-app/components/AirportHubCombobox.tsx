"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { filterHubsByQuery, formatHubLine } from "@/lib/hubs";
import type { AirportSearchResult } from "@/lib/airport-search";

export type AirportHubComboboxProps = {
  value: string;
  onChange: (icao: string) => void;
  id?: string;
  /** Label above the field */
  label?: string;
  hint?: string;
  placeholder?: string;
};

const defaultLabel = "Origin (hub or airport)";
const defaultHint = "Company hubs + search; 2+ letters load more airports from the database.";

/**
 * Hub + `airport_lookup` search (debounced, 2+ chars for API). Reused for origin and destination.
 */
export function AirportHubCombobox({
  value,
  onChange,
  id: idProp,
  label = defaultLabel,
  hint = defaultHint,
  placeholder = "e.g. KMIA, LGA, or EGLL",
}: AirportHubComboboxProps) {
  const genId = useId();
  const listboxId = idProp ?? `airport-hub-${genId}`;
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [apiResults, setApiResults] = useState<AirportSearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [rateMsg, setRateMsg] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const baseList: AirportSearchResult[] = useMemo(
    () =>
      filterHubsByQuery(value).map((h) => ({
        icao: h.icao,
        label: formatHubLine(h),
        kind: "hub" as const,
      })),
    [value]
  );

  const items = useMemo(() => {
    const q = value.trim();
    if (q.length < 2) return baseList;
    if (apiResults) return apiResults;
    return baseList;
  }, [value, baseList, apiResults]);

  useEffect(() => {
    const q = value.trim();
    if (q.length < 2) {
      setApiResults(null);
      setLoading(false);
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    setRateMsg(null);
    timerRef.current = setTimeout(() => {
      setLoading(true);
      fetch(`/api/airports/search?q=${encodeURIComponent(q)}`, { credentials: "include" })
        .then(async (r) => {
          if (r.status === 429) {
            setRateMsg("Too many searches — wait a moment.");
            setApiResults(null);
            return;
          }
          if (!r.ok) {
            setApiResults(null);
            return;
          }
          const d = (await r.json()) as { results: AirportSearchResult[] };
          setApiResults(d.results ?? []);
        })
        .catch(() => setApiResults(null))
        .finally(() => setLoading(false));
    }, 380);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [value]);

  useEffect(() => {
    setHighlight(0);
  }, [items.length, value]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (!open || items.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlight((h) => Math.min(h + 1, items.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((h) => Math.max(h - 1, 0));
      } else if (e.key === "Enter" && items[highlight]) {
        e.preventDefault();
        onChange(items[highlight]!.icao);
        setOpen(false);
      }
    },
    [open, items, highlight, onChange]
  );

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500" htmlFor={listboxId + "-input"}>
        {label}
      </label>
      <p className="mb-1 text-[10px] text-zinc-600">{hint}</p>
      <input
        id={listboxId + "-input"}
        type="text"
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId + "-listbox"}
        aria-autocomplete="list"
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className="mt-1 w-full rounded-lg border border-zinc-800 bg-black/50 px-3 py-2 text-sm text-white outline-none ring-0 focus:border-cyan-500/50"
        placeholder={placeholder}
      />
      {open ? (
        <ul
          id={listboxId + "-listbox"}
          role="listbox"
          className="absolute left-0 right-0 top-full z-[200] mt-1 max-h-64 overflow-y-auto rounded-lg border border-cyan-500/25 bg-zinc-950 py-1 text-sm shadow-[0_12px_48px_rgba(0,0,0,0.85)]"
        >
          {loading && value.trim().length >= 2 ? (
            <li className="px-3 py-2 text-xs text-zinc-500">Searching…</li>
          ) : null}
          {!loading && items.length === 0 ? (
            <li className="px-3 py-2 text-xs text-zinc-500">No matches</li>
          ) : null}
          {items.map((it, i) => (
            <li
              key={`${it.kind}-${it.icao}`}
              role="option"
              aria-selected={i === highlight}
              className={
                i === highlight
                  ? "cursor-pointer bg-cyan-500/15 px-3 py-2 text-cyan-100"
                  : "cursor-pointer px-3 py-2 text-zinc-200 hover:bg-zinc-800/80"
              }
              onMouseEnter={() => setHighlight(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(it.icao);
                setOpen(false);
              }}
            >
              <span
                className={
                  it.kind === "hub" ? "text-cyan-300/90" : "text-amber-200/80"
                }
                style={{ fontSize: "10px" }}
              >
                {it.kind === "hub" ? "HUB" : "AP"}
              </span>{" "}
              {it.label}
            </li>
          ))}
        </ul>
      ) : null}
      {rateMsg ? <p className="mt-1 text-xs text-orange-400">{rateMsg}</p> : null}
    </div>
  );
}

/** @deprecated Use AirportHubCombobox — alias kept for older imports */
export const OriginHubCombobox = AirportHubCombobox;
