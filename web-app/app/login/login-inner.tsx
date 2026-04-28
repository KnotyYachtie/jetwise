"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "⌫"];

export default function LoginInner() {
  const [pin, setPin] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const sp = useSearchParams();
  const from = sp.get("from") || "/";

  function press(k: string) {
    setErr(null);
    if (k === "C") {
      setPin("");
      return;
    }
    if (k === "⌫") {
      setPin((p) => p.slice(0, -1));
      return;
    }
    if (pin.length >= 6) return;
    setPin((p) => p + k);
  }

  async function submit() {
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
        credentials: "include",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error || "Access denied");
      }
      router.replace(from);
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="jw-app-shell flex min-h-screen flex-col">
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-2xl border border-cyan-500/25 bg-[var(--jw-panel)] p-8 shadow-[0_0_100px_-28px_rgba(34,211,238,0.42),0_0_70px_-40px_rgba(251,146,60,0.15)] backdrop-blur-xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 h-3 w-3 rounded-full bg-cyan-400 shadow-[0_0_18px_rgba(34,211,238,0.9)]" />
          <h1 className="text-2xl font-semibold text-white">Jetwise</h1>
          <p className="mt-2 text-xs uppercase tracking-[0.25em] text-zinc-500">Secure access</p>
        </div>

        <div
          className="mb-6 flex h-12 items-center justify-center rounded-lg border border-cyan-500/20 bg-black/50 font-mono text-2xl tracking-[0.4em] text-cyan-200"
          aria-live="polite"
        >
          {pin.replace(/./g, "•")}
        </div>

        {err ? <p className="mb-4 text-center text-sm text-orange-400">{err}</p> : null}

        <div className="grid grid-cols-3 gap-3">
          {keys.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => press(k)}
              className="h-12 rounded-lg border border-cyan-500/20 bg-zinc-950/80 text-sm font-semibold text-cyan-100 transition hover:border-cyan-400/60 hover:shadow-[0_0_24px_rgba(34,211,238,0.2)] active:scale-[0.98]"
            >
              {k}
            </button>
          ))}
        </div>

        <button
          type="button"
          disabled={loading || pin.length < 4}
          onClick={() => void submit()}
          className="mt-6 w-full rounded-xl border border-cyan-500/40 bg-cyan-500/10 py-3 text-sm font-bold uppercase tracking-widest text-cyan-100 transition enabled:hover:bg-cyan-500/20 disabled:opacity-40"
        >
          {loading ? "…" : "Enter"}
        </button>
        </div>
      </div>
    </div>
  );
}
