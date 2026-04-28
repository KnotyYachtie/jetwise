import { NextResponse } from "next/server";
import { createSessionToken, getPin, SESSION_COOKIE } from "@/lib/session";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const pin = String(body?.pin ?? "");
    if (pin !== getPin()) {
      return NextResponse.json({ error: "Invalid access code" }, { status: 401 });
    }
    const token = await createSessionToken();
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 90 * 24 * 60 * 60,
    });
    return res;
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
