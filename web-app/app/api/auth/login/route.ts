import { NextResponse } from "next/server";
import { createSessionToken, getPin, SESSION_COOKIE } from "@/lib/session";

function hasAuthSecret(): boolean {
  return Boolean(
    (process.env.JETWISE_AUTH_SECRET && process.env.JETWISE_AUTH_SECRET.trim()) ||
      (process.env.AUTH_SECRET && process.env.AUTH_SECRET.trim())
  );
}

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production" && !hasAuthSecret()) {
    return NextResponse.json(
      {
        error:
          "Server misconfiguration: set JETWISE_AUTH_SECRET in Vercel (Environment Variables), then redeploy.",
      },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const pin = String((body as { pin?: string })?.pin ?? "");
  if (pin !== getPin()) {
    return NextResponse.json({ error: "Invalid access code" }, { status: 401 });
  }

  let token: string;
  try {
    token = await createSessionToken();
  } catch (e) {
    console.error("createSessionToken", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not create session" },
      { status: 500 }
    );
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 90 * 24 * 60 * 60,
  });
  return res;
}
