import { Suspense } from "react";
import LoginInner from "./login-inner";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="jw-app-shell flex min-h-screen flex-col bg-black">
          <div className="relative z-10 flex flex-1 items-center justify-center">
            <div className="h-10 w-10 animate-pulse rounded-full border border-cyan-500/30 bg-zinc-950" />
          </div>
        </div>
      }
    >
      <LoginInner />
    </Suspense>
  );
}
