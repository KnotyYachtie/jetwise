"use client";

import { useEffect, useState } from "react";
import { JwCard } from "@/components/JwCard";
import { api } from "@/lib/api-client";

type Company = {
  fuel_price: number;
  co2_price: number;
  fuel_training: number;
  co2_training: number;
  repair_training: number;
  load: number;
  ci: number;
};

export default function SettingsPage() {
  const [draft, setDraft] = useState<Company | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<{ company: Company }>("/api/company")
      .then((j) => {
        setDraft(j.company);
      })
      .catch((e: Error) => setErr(e.message));
  }, []);

  async function save() {
    if (!draft) return;
    setSaving(true);
    setErr(null);
    try {
      const j = await api<{ company: Company }>("/api/company", {
        method: "PUT",
        body: JSON.stringify(draft),
      });
      setDraft(j.company);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (!draft) {
    return err ? (
      <JwCard title="Markets" subtitle="Error">
        <p className="text-sm text-orange-400">{err}</p>
      </JwCard>
    ) : (
      <div className="h-40 animate-pulse rounded-2xl bg-zinc-900/60 ring-1 ring-cyan-500/10" />
    );
  }

  const fields: { key: keyof Company; label: string }[] = [
    { key: "fuel_price", label: "Fuel price" },
    { key: "co2_price", label: "CO₂ price" },
    { key: "fuel_training", label: "Fuel training %" },
    { key: "co2_training", label: "CO₂ training %" },
    { key: "repair_training", label: "Repair training %" },
    { key: "load", label: "Load factor (0–1)" },
    { key: "ci", label: "Cost index (CI)" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-white">Markets &amp; training</h1>
        <p className="mt-1 text-sm text-zinc-500">Backbone inputs — drives burn, speed, and cost multipliers.</p>
      </div>
      {err ? <p className="text-sm text-orange-400">{err}</p> : null}
      <JwCard title="Company state" subtitle="REALISM defaults; update to match your sim">
        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map((f) => (
            <label key={f.key} className="text-sm">
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{f.label}</span>
              <input
                type="number"
                className="mt-1 w-full rounded-lg border border-zinc-800 bg-black/50 px-3 py-2 text-sm text-white"
                value={String(draft[f.key])}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  setDraft((d) => (d ? { ...d, [f.key]: Number.isFinite(v) ? v : d[f.key] } : d));
                }}
              />
            </label>
          ))}
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="mt-6 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm font-bold uppercase tracking-widest text-cyan-100 disabled:opacity-40"
        >
          {saving ? "…" : "Save"}
        </button>
      </JwCard>
    </div>
  );
}
