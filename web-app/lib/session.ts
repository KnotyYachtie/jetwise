import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "jetwise_session";

const DEFAULT_PIN = "3363";

export function getPin(): string {
  return process.env.JETWISE_PIN ?? DEFAULT_PIN;
}

export function getAuthSecret(): string {
  const s = process.env.JETWISE_AUTH_SECRET || process.env.AUTH_SECRET;
  if (!s) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Set JETWISE_AUTH_SECRET for JWT sessions.");
    }
    return "jetwise-dev-secret-change-in-production";
  }
  return s;
}

export async function createSessionToken(): Promise<string> {
  const secret = new TextEncoder().encode(getAuthSecret());
  return new SignJWT({ sub: "jetwise" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("90d")
    .sign(secret);
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    const secret = new TextEncoder().encode(getAuthSecret());
    await jwtVerify(token, secret);
    return true;
  } catch {
    return false;
  }
}
