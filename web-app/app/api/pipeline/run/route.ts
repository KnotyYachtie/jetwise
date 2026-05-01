import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

/** Runs local bash pipeline (needs repo `.venv`, parquet inputs under ~/Downloads, Postgres in `.env.local`). */

export const runtime = "nodejs";

const PIPELINE_UNAVAILABLE =
  "Route pipeline only runs on a full developer checkout with Python (.venv), Polars scripts, and Postgres — not on serverless deploys.";

function whyPipelineSkipped(repoRoot: string): string | null {
  if (process.env.VERCEL === "1") {
    return `${PIPELINE_UNAVAILABLE} (detected Vercel)`;
  }
  if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return `${PIPELINE_UNAVAILABLE} (detected AWS Lambda)`;
  }
  const scriptPath = path.join(repoRoot, "run_pipeline.sh");
  if (!fs.existsSync(scriptPath)) {
    return `Missing ${scriptPath} — deploy bundle does not include monorepo root scripts. Run locally: cd web-app && npm run pipeline`;
  }
  const py = path.join(repoRoot, ".venv", "bin", "python");
  if (!fs.existsSync(py)) {
    return `Missing Python venv at ${py}. From repo root: python3 -m venv .venv && .venv/bin/pip install polars — then npm run pipeline from web-app/`;
  }
  try {
    fs.accessSync(py, fs.constants.X_OK);
  } catch {
    return `Python at ${py} is not executable`;
  }
  return null;
}

export async function POST() {
  // Repo root = parent of web-app (avoid tracing OS homedirs; Turbopack NFT hint).
  const repoRoot = path.join(/* turbopackIgnore: true */ process.cwd(), "..");
  const scriptPath = path.join(repoRoot, "run_pipeline.sh");

  const skipReason = whyPipelineSkipped(repoRoot);
  if (skipReason) {
    return NextResponse.json(
      {
        ok: false as const,
        error: skipReason,
        log: `[skipped] ${skipReason}\n\nLocal: clone repo, create .venv at root, then from web-app run npm run pipeline`,
      },
      { status: 503 }
    );
  }

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
