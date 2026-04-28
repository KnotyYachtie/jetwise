import { Suspense } from "react";
import LoginInner from "./login-inner";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-black">
          <div className="h-10 w-10 animate-pulse rounded-full border border-cyan-500/30 bg-zinc-950" />
        </div>
      }
    >
      <LoginInner />
    </Suspense>
  );
}
