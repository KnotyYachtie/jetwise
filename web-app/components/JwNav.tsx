"use client";

import Link from "next/link";
import { Building2, House, LogOut, Route as RouteIcon, Settings2, Sparkles } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

const items = [
  { href: "/", label: "Home", icon: House },
  { href: "/routes", label: "Routes", icon: RouteIcon },
  { href: "/routes/suggestions", label: "Ideas", icon: Sparkles },
  { href: "/hubs", label: "Hubs", icon: Building2 },
  { href: "/settings", label: "Settings", icon: Settings2 },
];

function pill(href: string, current: string) {
  if (href === "/") return current === "/";
  if (href === "/routes/suggestions") return current === href || current.startsWith(`${href}/`);
  if (href === "/routes") {
    return (current === href || current.startsWith("/routes/")) && !current.startsWith("/routes/suggestions");
  }
  return current === href || current.startsWith(`${href}/`);
}

function linkClass(on: boolean) {
  return on
    ? "rounded-lg bg-cyan-500/15 px-3 py-1.5 text-sm text-cyan-200 ring-1 ring-cyan-500/40"
    : "rounded-lg px-3 py-1.5 text-sm text-zinc-400 hover:text-cyan-200";
}

export function JwNavHeader() {
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
        <div className="flex min-w-0 items-center gap-2">
          <div
            className="h-2.5 w-2.5 shrink-0 rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.9)] jw-animate-pulse-slow"
            aria-hidden
          />
          <Link href="/" className="truncate font-semibold tracking-wide text-white">
            Jetwise
          </Link>
          <span className="hidden shrink-0 rounded border border-zinc-700 px-2 py-0.5 text-[10px] font-mono uppercase text-zinc-500 sm:inline">
            Ops
          </span>
        </div>
        <nav
          aria-label="Desktop navigation"
          className="hidden max-w-none flex-wrap items-center justify-end gap-1 md:flex"
        >
          {items.map((it) => {
            const on = pill(it.href, pathname);
            return (
              <Link key={it.href} href={it.href} className={linkClass(on)}>
                {it.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => void logout()}
            className="ml-2 rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-400 hover:border-cyan-500/50 hover:text-cyan-200"
          >
            <span className="inline-flex items-center gap-2">
              <LogOut className="h-4 w-4" aria-hidden strokeWidth={1.8} />
              Logout
            </span>
          </button>
        </nav>
      </div>
    </header>
  );
}

export function JwMobileBottomNav() {
  const pathname = usePathname() || "/";

  return (
    <nav
      aria-label="Mobile navigation"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(0.875rem,env(safe-area-inset-bottom))] md:hidden"
    >
      <div className="pointer-events-auto mx-auto max-w-md rounded-[30px] border border-white/10 bg-black/65 shadow-[0_16px_50px_-24px_rgba(0,0,0,0.85),0_0_0_1px_rgba(34,211,238,0.08),inset_0_1px_0_0_rgba(255,255,255,0.05)] backdrop-blur-2xl">
        <div className="grid grid-cols-5 items-end gap-1 px-3 pb-3 pt-2">
          {items.map((it) => {
            const on = pill(it.href, pathname);
            const Icon = it.icon;
            return (
              <Link key={it.href} href={it.href} className="flex min-w-0 flex-col items-center justify-end gap-1 pb-0.5">
                <span
                  className={
                    on
                      ? "mb-0.5 flex h-14 w-14 -translate-y-3 items-center justify-center rounded-full border border-cyan-300/30 bg-[radial-gradient(circle_at_50%_35%,rgba(54,238,246,0.32),rgba(10,37,49,0.96)_72%)] text-cyan-50 shadow-[0_14px_30px_-14px_rgba(34,211,238,0.92),0_0_28px_-14px_rgba(34,211,238,0.85)]"
                      : "flex h-10 w-10 items-center justify-center rounded-full text-zinc-500"
                  }
                >
                  <Icon className={on ? "h-5 w-5" : "h-5 w-5 opacity-80"} aria-hidden strokeWidth={1.9} />
                </span>
                <span
                  className={
                    on
                      ? "max-w-full truncate text-[11px] font-medium text-cyan-100"
                      : "max-w-full truncate text-[11px] font-medium text-zinc-500"
                  }
                >
                  {it.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
