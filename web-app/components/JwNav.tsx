"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const items: { href: string; label: string; mobileLabel: string }[] = [
  { href: "/", label: "Fleet", mobileLabel: "Fleet" },
  { href: "/routes", label: "Routes", mobileLabel: "Routes" },
  { href: "/hubs", label: "Hubs", mobileLabel: "Hubs" },
  { href: "/reallocation", label: "Reallocate", mobileLabel: "Move" },
  { href: "/settings", label: "Markets", mobileLabel: "Mkts" },
];

function pill(href: string, current: string) {
  if (href === "/") return current === "/";
  return current === href || (current.startsWith(href) && href !== "/");
}

function IconFleet({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
    </svg>
  );
}

function IconRoutes({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path d="M3 18h18M5 18l4-9 4 3 4-6 4 12" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="9" cy="9" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="17" cy="6" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconHubs({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path d="M4 20V10l4-2v12M10 20V6l4-2v16M16 20v-8l4-2v10" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 20h20" strokeLinecap="round" />
    </svg>
  );
}

function IconRealloc({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path d="M7 16V4m0 0L4 7m3-3 3 3M17 8v12m0 0 3-3m-3 3-3-3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconMarkets({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path d="M12 3v18M3 12h18" strokeLinecap="round" />
      <circle cx="12" cy="12" r="8" strokeDasharray="4 3" />
    </svg>
  );
}

function IconLogout({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path d="M10 17H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h4M14 7l5 5-5 5M19 12H9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const mobileIcons = [IconFleet, IconRoutes, IconHubs, IconRealloc, IconMarkets] as const;

function linkClass(on: boolean) {
  return on
    ? "rounded-lg bg-cyan-500/15 px-3 py-1.5 text-sm text-cyan-200 ring-1 ring-cyan-500/40"
    : "rounded-lg px-3 py-1.5 text-sm text-zinc-400 hover:text-cyan-200";
}

function bottomItemClass(on: boolean) {
  return [
    "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-2 text-[10px] font-medium leading-tight transition-colors",
    on
      ? "text-cyan-200 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.35)] bg-cyan-500/10"
      : "text-zinc-500 active:bg-white/5",
  ].join(" ");
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
            Logout
          </button>
        </nav>
      </div>
    </header>
  );
}

export function JwMobileBottomNav() {
  const pathname = usePathname() || "/";
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    router.push("/login");
    router.refresh();
  }

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-cyan-500/30 bg-black/70 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-12px_40px_-18px_rgba(34,211,238,0.22),inset_0_1px_0_0_rgba(251,146,60,0.08)] backdrop-blur-xl md:hidden"
    >
      <div className="mx-auto flex max-w-6xl items-end justify-between gap-0.5 px-1 pt-1">
        {items.map((it, i) => {
          const on = pill(it.href, pathname);
          const Icon = mobileIcons[i];
          return (
            <Link key={it.href} href={it.href} className={bottomItemClass(on)}>
              <Icon className="h-5 w-5 shrink-0" />
              <span className="max-w-full truncate">{it.mobileLabel}</span>
            </Link>
          );
        })}
        <button type="button" onClick={() => void logout()} className={bottomItemClass(false)}>
          <IconLogout className="h-5 w-5 shrink-0 text-zinc-400" />
          <span className="max-w-full truncate text-zinc-400">Logout</span>
        </button>
      </div>
    </nav>
  );
}
