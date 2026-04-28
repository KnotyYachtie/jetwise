import { JwNav } from "@/components/JwNav";

export default function AppShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="jw-app-shell flex min-h-screen flex-col">
      <JwNav />
      <main className="relative z-10 mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
