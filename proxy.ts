import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/api/auth", "/privacy", "/terms", "/cookies"];
// Static assets served from /public (logo, images, fonts, etc.) — must never be
// gated behind auth, or unauthenticated pages (e.g. /login) can't load them.
const PUBLIC_FILE = /\.(?:svg|png|jpe?g|gif|webp|ico|txt|xml|json|webmanifest|woff2?|ttf|otf)$/i;

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths and static assets
  if (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    PUBLIC_FILE.test(pathname)
  ) {
    return NextResponse.next();
  }

  const session = req.cookies.get("ra_session")?.value;

  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  // Parse session to get role for portal/staff separation
  try {
    // We don't decode JWT in middleware (avoid crypto in edge runtime).
    // Role-based routing is enforced by each page's auth guard instead.
    // Middleware only ensures a session cookie exists.
    return NextResponse.next();
  } catch {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
