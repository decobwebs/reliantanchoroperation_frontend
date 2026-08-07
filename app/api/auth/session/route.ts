import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const COOKIE_NAME = "ra_session";
/** Readable by the login page (not httpOnly) — carries only why the session
 *  ended, never anything sensitive. Short-lived so a stale reason can't
 *  resurface on a later visit. */
const REASON_COOKIE = "ra_session_ended";

/**
 * Session limits.
 *
 * ABSOLUTE_MS is a hard ceiling measured from the moment the user typed their
 * password — it is never extended by activity or by a token refresh. Without
 * it the cookie's own maxAge was being rewritten on every silent refresh,
 * which turned a "7 day" session into an indefinite one: anyone opening the
 * app once a week stayed signed in forever.
 *
 * IDLE_MS closes the gap the absolute cap leaves open — an unattended device
 * mid-shift. `last_seen` is bumped by a throttled heartbeat from the client
 * (see SessionGuard) rather than on every request, so this costs one extra
 * call every few minutes at most.
 *
 * Both are enforced here, server-side, on a cookie the browser cannot read or
 * forge (httpOnly). Client-side timers only decide *when* to redirect; they
 * are never what makes a session valid.
 */
const ABSOLUTE_MS = 12 * 60 * 60 * 1000; // one working shift
const IDLE_MS = 60 * 60 * 1000; // unattended device

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

type SessionPayload = {
  access_token: string;
  refresh_token?: string | null;
  started_at: number;
  last_seen: number;
};

function readSession(raw: string | undefined): SessionPayload | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.access_token) return null;
    // Sessions issued before these limits existed carry no timestamps. Treat
    // the absence as "starts now" rather than "expired", so shipping this
    // doesn't sign everyone out mid-operation.
    return {
      access_token: parsed.access_token,
      refresh_token: parsed.refresh_token ?? null,
      started_at: typeof parsed.started_at === "number" ? parsed.started_at : Date.now(),
      last_seen: typeof parsed.last_seen === "number" ? parsed.last_seen : Date.now(),
    };
  } catch {
    return null;
  }
}

/** Which limit, if either, this session has passed. */
export function expiryReason(s: SessionPayload, now = Date.now()): "absolute" | "idle" | null {
  if (now - s.started_at >= ABSOLUTE_MS) return "absolute";
  if (now - s.last_seen >= IDLE_MS) return "idle";
  return null;
}

/** Seconds the cookie should live: never beyond the absolute deadline. */
function remainingSeconds(startedAt: number, now = Date.now()): number {
  return Math.max(0, Math.floor((startedAt + ABSOLUTE_MS - now) / 1000));
}

/** POST /api/auth/session — store tokens in an httpOnly cookie. */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { access_token, refresh_token } = body;
  if (!access_token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const existing = readSession(cookieStore.get(COOKIE_NAME)?.value);
  const now = Date.now();

  // A token refresh must inherit the original start time. Resetting it here is
  // exactly what made sessions immortal before.
  const startedAt = existing && !expiryReason(existing, now) ? existing.started_at : now;

  if (now - startedAt >= ABSOLUTE_MS) {
    cookieStore.delete(COOKIE_NAME);
    return NextResponse.json({ error: "Session expired" }, { status: 401 });
  }

  const payload: SessionPayload = {
    access_token,
    refresh_token: refresh_token ?? existing?.refresh_token ?? null,
    started_at: startedAt,
    last_seen: now,
  };

  cookieStore.set(COOKIE_NAME, JSON.stringify(payload), {
    ...COOKIE_OPTS,
    maxAge: remainingSeconds(startedAt, now),
  });
  return NextResponse.json({ ok: true, expires_at: startedAt + ABSOLUTE_MS });
}

/** GET /api/auth/session — hydrate the client, enforcing both limits. */
export async function GET() {
  const cookieStore = await cookies();
  const session = readSession(cookieStore.get(COOKIE_NAME)?.value);
  if (!session) return NextResponse.json({ access_token: null });

  const reason = expiryReason(session);
  if (reason) {
    cookieStore.delete(COOKIE_NAME);
    cookieStore.set(REASON_COOKIE, reason, {
      httpOnly: false, secure: COOKIE_OPTS.secure, sameSite: "lax", path: "/", maxAge: 120,
    });
    return NextResponse.json({ access_token: null, expired: reason });
  }

  return NextResponse.json({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.started_at + ABSOLUTE_MS,
    idle_deadline: session.last_seen + IDLE_MS,
  });
}

/** PATCH /api/auth/session — heartbeat: the user is still here. */
export async function PATCH() {
  const cookieStore = await cookies();
  const session = readSession(cookieStore.get(COOKIE_NAME)?.value);
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });

  const reason = expiryReason(session);
  if (reason) {
    cookieStore.delete(COOKIE_NAME);
    cookieStore.set(REASON_COOKIE, reason, {
      httpOnly: false, secure: COOKIE_OPTS.secure, sameSite: "lax", path: "/", maxAge: 120,
    });
    return NextResponse.json({ ok: false, expired: reason }, { status: 401 });
  }

  const now = Date.now();
  cookieStore.set(
    COOKIE_NAME,
    JSON.stringify({ ...session, last_seen: now }),
    { ...COOKIE_OPTS, maxAge: remainingSeconds(session.started_at, now) },
  );
  return NextResponse.json({
    ok: true,
    expires_at: session.started_at + ABSOLUTE_MS,
    idle_deadline: now + IDLE_MS,
  });
}
