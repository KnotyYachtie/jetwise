"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { OriginHubCombobox } from "@/components/OriginHubCombobox";
import { JwCard } from "@/components/JwCard";
import { api } from "@/lib/api-client";
import { isValidHub } from "@/lib/hubs";

type Ac = { type: "A380" | "A330"; y: string; j: string; f: string };

export default function RouteForm({ editId }: { editId?: string }) {
  const router = useRouter();
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [distance, setDistance] = useState("");
  const [demandY, setDemandY] = useState("0");
  const [demandJ, setDemandJ] = useState("0");
  const [demandF, setDemandF] = useState("0");
  const [technical, setTechnical] = useState("");
  const [notes, setNotes] = useState("");
  const [aircraft, setAircraft] = useState<Ac[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!editId) return;
    (async () => {
      try {
        const j = await api<{ route: Record<string, unknown> }>(`/api/routes/${editId}`);
        const r = j.route as {
          origin: string;
          destination: string;
          distance: number;
          hub: string | null;
          demand: { y: number; j: number; f: number };
          technical_stop: string | null;
          notes: string | null;
          current: { aircraft: { type: string; config: { y: number; j: number; f: number } }[] };
        };
        setOrigin(r.origin);
        setDestination(r.destination);
        setDistance(String(r.distance));
        setDemandY(String(r.demand.y));
        setDemandJ(String(r.demand.j));
        setDemandF(String(r.demand.f));
        setTechnical(r.technical_stop || "");
        setNotes(r.notes || "");
        setAircraft(
          r.current.aircraft.map((a) => ({
            type: a.type === "A330" ? "A330" : "A380",
            y: String(a.config.y),
            j: String(a.config.j),
            f: String(a.config.f),
          }))
        );
      } catch (e) {
        setErr((e as Error).message);
      }
    })();
  }, [editId]);

  function addAircraft() {
    setAircraft((a) => [...a, { type: "A380", y: "0", j: "0", f: "0" }]);
  }

  async function save() {
    setErr(null);
    setLoading(true);
    try {
      const assignments = aircraft.map((a) => ({
        type: a.type,
        config: {
          y: parseInt(a.y, 10) || 0,
          j: parseInt(a.j, 10) || 0,
          f: parseInt(a.f, 10) || 0,
        },
      }));
      const payload = {
        origin,
        destination,
        distance: parseFloat(distance),
        hub: isValidHub(origin) ? origin.toUpperCase() : null,
        demand_y: parseInt(demandY, 10) || 0,
        demand_j: parseInt(demandJ, 10) || 0,
        demand_f: parseInt(demandF, 10) || 0,
        technical_stop: technical || null,
        notes: notes || null,
        assignments,
      };
      if (editId) {
        await api(`/api/routes/${editId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        router.push(`/routes/${editId}`);
      } else {
        const res = await api<{ id: string }>("/api/routes", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        router.push(`/routes/${res.id}`);
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-white">{editId ? "Edit route" : "New route"}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Origin picks hub or research airport; fleet hub is set automatically when origin is a company hub.
        </p>
      </div>
      {err ? <p className="text-sm text-orange-400">{err}</p> : null}

      <JwCard title="Leg" subtitle="Great-circle distance (km); origin drives hub when it is a company hub">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <OriginHubCombobox value={origin} onChange={setOrigin} />
          </div>
          <Field label="Destination" value={destination} onChange={(v) => setDestination(v.toUpperCase())} />
          <Field label="Distance (km)" value={distance} onChange={setDistance} inputMode="decimal" />
        </div>
      </JwCard>

      <JwCard title="Demand" subtitle="Economy / business / first">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Y" value={demandY} onChange={setDemandY} inputMode="numeric" />
          <Field label="J" value={demandJ} onChange={setDemandJ} inputMode="numeric" />
          <Field label="F" value={demandF} onChange={setDemandF} inputMode="numeric" />
        </div>
      </JwCard>

      <JwCard title="Ops" subtitle="Optional technical stop & notes">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Technical stop ICAO" value={technical} onChange={(v) => setTechnical(v.toUpperCase())} />
          <Field label="Notes" value={notes} onChange={setNotes} />
        </div>
      </JwCard>

      <JwCard title="Current aircraft" subtitle="One row per airframe — order matters for demand clearing">
        <div className="space-y-3">
          {aircraft.map((a, i) => (
            <div key={i} className="grid gap-3 rounded-lg border border-zinc-800 bg-black/40 p-3 sm:grid-cols-5">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Type</label>
                <select
                  value={a.type}
                  onChange={(e) => {
                    const next = [...aircraft];
                    next[i] = { ...next[i]!, type: e.target.value as "A380" | "A330" };
                    setAircraft(next);
                  }}
                  className="mt-1 w-full rounded border border-zinc-800 bg-black px-2 py-1 text-sm"
                >
                  <option value="A380">A380</option>
                  <option value="A330">A330</option>
                </select>
              </div>
              <Field label="Y" value={a.y} onChange={(v) => {
                const next = [...aircraft];
                next[i] = { ...next[i]!, y: v };
                setAircraft(next);
              }} />
              <Field label="J" value={a.j} onChange={(v) => {
                const next = [...aircraft];
                next[i] = { ...next[i]!, j: v };
                setAircraft(next);
              }} />
              <Field label="F" value={a.f} onChange={(v) => {
                const next = [...aircraft];
                next[i] = { ...next[i]!, f: v };
                setAircraft(next);
              }} />
              <div className="flex items-end">
                <button
                  type="button"
                  className="w-full rounded border border-orange-500/30 py-2 text-xs text-orange-300"
                  onClick={() => setAircraft((r) => r.filter((_, j) => j !== i))}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={addAircraft}
            className="rounded-lg border border-cyan-500/30 px-3 py-2 text-sm text-cyan-200"
          >
            + Add aircraft
          </button>
        </div>
      </JwCard>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={loading}
          onClick={() => void save()}
          className="rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-5 py-2.5 text-sm font-bold uppercase tracking-widest text-cyan-100 disabled:opacity-40"
        >
          {loading ? "…" : "Save route"}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  inputMode?: "numeric" | "decimal" | "text";
}) {
  return (
    <div>
      <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode={inputMode}
        className="mt-1 w-full rounded-lg border border-zinc-800 bg-black/50 px-3 py-2 text-sm text-white outline-none ring-0 focus:border-cyan-500/50"
      />
    </div>
  );
}
