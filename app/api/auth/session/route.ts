import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const COOKIE_NAME = "ra_session";
const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 7, // 7 days
};

/** POST /api/auth/session — store tokens in httpOnly cookie */
export async function POST(req: NextRequest) {
  const { access_token, refresh_token } = await req.json();
  if (!access_token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }
  const cookieStore = await cookies();
  cookieStore.set(
    COOKIE_NAME,
    JSON.stringify({ access_token, refresh_token }),
    COOKIE_OPTS
  );
  return NextResponse.json({ ok: true });
}

/** GET /api/auth/session — return stored token (for client-side hydration) */
export async function GET() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(COOKIE_NAME)?.value;
  if (!raw) return NextResponse.json({ access_token: null });
  try {
    const { access_token, refresh_token } = JSON.parse(raw);
    return NextResponse.json({ access_token, refresh_token });
  } catch {
    return NextResponse.json({ access_token: null });
  }
}
