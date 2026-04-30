import { JwRouteWorldMapBackdrop } from "@/components/JwRouteWorldMapBackdrop";
import { JwMobileBottomNav, JwNavHeader } from "@/components/JwNav";
import { getRouteMapDots } from "@/lib/route-map-dots";

export const dynamic = "force-dynamic";

export default async function AppShellLayout({ children }: { children: React.ReactNode }) {
  const dots = await getRouteMapDots();

  return (
    <div className="jw-app-shell flex min-h-screen flex-col">
      <JwRouteWorldMapBackdrop dots={dots} />
      <JwNavHeader />
      <main className="relative z-10 mx-auto w-full max-w-6xl flex-1 px-4 pb-[calc(5.25rem+env(safe-area-inset-bottom))] pt-8 md:pb-8">
        {children}
      </main>
      <JwMobileBottomNav />
    </div>
  );
}
