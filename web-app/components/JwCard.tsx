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
      className={`rounded-2xl border border-cyan-500/20 bg-[var(--jw-panel)] p-5 shadow-[0_0_80px_-22px_rgba(34,211,238,0.38),0_0_55px_-38px_rgba(251,146,60,0.14)] backdrop-blur-xl transition-shadow duration-500 hover:shadow-[0_0_90px_-18px_rgba(34,211,238,0.42),0_0_70px_-36px_rgba(251,146,60,0.18)] ${className}`}
    >
      <div className="mb-4 flex flex-col gap-1">
        <h2 className="text-lg font-semibold tracking-tight text-white">{title}</h2>
        {subtitle ? <p className="text-xs text-zinc-500">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}
