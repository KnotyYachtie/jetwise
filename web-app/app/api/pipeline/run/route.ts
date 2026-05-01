import { spawn } from "node:child_process";
import path from "node:path";
import { NextResponse } from "next/server";

/** Runs local bash pipeline (needs repo `.venv`, parquet inputs under ~/Downloads, Postgres in `.env.local`). */

export const runtime = "nodejs";

export async function POST() {
  // Repo root = parent of web-app (avoid tracing OS homedirs; Turbopack NFT hint).
  const repoRoot = path.join(/* turbopackIgnore: true */ process.cwd(), "..");
  const scriptPath = path.join(repoRoot, "run_pipeline.sh");

  const chunks: Buffer[] = [];

  const proc = spawn("bash", [scriptPath], {
    cwd: repoRoot,
    env: process.env as NodeJS.ProcessEnv,
    stdio: ["ignore", "pipe", "pipe"],
  });

  proc.stdout?.on("data", (c: Buffer) => {
    chunks.push(c);
  });
  proc.stderr?.on("data", (c: Buffer) => {
    chunks.push(c);
  });

  const code = await new Promise<number>((resolve, reject) => {
    proc.once("error", reject);
    proc.once("close", (c) => resolve(typeof c === "number" ? c : 1));
  });

  const log = Buffer.concat(chunks).toString("utf8");

  if (code !== 0) {
    return NextResponse.json(
      { ok: false as const, error: `pipeline exited with code ${code}`, log },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true as const, log });
}
