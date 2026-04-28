import { JwMobileBottomNav, JwNavHeader } from "@/components/JwNav";

export default function AppShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="jw-app-shell flex min-h-screen flex-col">
      <JwNavHeader />
      <main className="relative z-10 mx-auto w-full max-w-6xl flex-1 px-4 pb-[calc(5.25rem+env(safe-area-inset-bottom))] pt-8 md:pb-8">
        {children}
      </main>
      <JwMobileBottomNav />
    </div>
  );
}
