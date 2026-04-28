"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const items: { href: string; label: string }[] = [
  { href: "/", label: "Fleet" },
  { href: "/routes", label: "Routes" },
  { href: "/hubs", label: "Hubs" },
  { href: "/reallocation", label: "Reallocate" },
  { href: "/settings", label: "Markets" },
];

function pill(href: string, current: string) {
  if (href === "/") return current === "/";
  return current === href || (current.startsWith(href) && href !== "/");
}

export function JwNav() {
  const pathname = usePathname() || "/";
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 border-b border-cyan-500/25 bg-black/55 shadow-[0_12px_48px_-28px_rgba(34,211,238,0.25),inset_0_-1px_0_0_rgba(251,146,60,0.12)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-2">
          <div
            className="h-2.5 w-2.5 rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.9)] jw-animate-pulse-slow"
            aria-hidden
          />
          <Link href="/" className="font-semibold tracking-wide text-white">
            Jetwise
          </Link>
          <span className="rounded border border-zinc-700 px-2 py-0.5 text-[10px] font-mono uppercase text-zinc-500">
            Ops
          </span>
        </div>
        <nav className="flex max-w-[min(100%,28rem)] flex-wrap items-center justify-end gap-1 overflow-x-auto sm:max-w-none">
          {items.map((it) => {
            const on = pill(it.href, pathname);
            return (
              <Link
                key={it.href}
                href={it.href}
                className={
                  on
                    ? "rounded-lg bg-cyan-500/15 px-3 py-1.5 text-sm text-cyan-200 ring-1 ring-cyan-500/40"
                    : "rounded-lg px-3 py-1.5 text-sm text-zinc-400 hover:text-cyan-200"
                }
              >
                {it.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => void logout()}
            className="ml-2 rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-400 hover:border-cyan-500/50 hover:text-cyan-200"
          >
            Logout
          </button>
        </nav>
      </div>
    </header>
  );
}
