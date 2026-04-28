import type { ReactNode } from "react";

export function JwCard({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-cyan-500/20 bg-[var(--jw-panel)] p-5 shadow-[0_0_80px_-20px_rgba(34,211,238,0.35)] backdrop-blur-xl ${className}`}
    >
      <div className="mb-4 flex flex-col gap-1">
        <h2 className="text-lg font-semibold tracking-tight text-white">{title}</h2>
        {subtitle ? <p className="text-xs text-zinc-500">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}
