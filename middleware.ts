import { NextRequest, NextResponse } from "next/server";

const LOGIN_PATH = "/login";
const SESSION_COOKIE = "xeno_session";

// Routes that bypass auth entirely
function isPublic(pathname: string): boolean {
  return (
    pathname === LOGIN_PATH ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/shopify/callback") ||
    pathname.startsWith("/api/webhooks/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon")
  );
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();

  // Only protect /dashboard/** and /api/** (except public above)
  const needsAuth =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/api/");

  if (!needsAuth) return NextResponse.next();

  const session = req.cookies.get(SESSION_COOKIE)?.value;
  const expected = process.env.XENO_SESSION_SECRET;

  // If no session secret is set, allow access (unconfigured deploy)
  if (!expected) return NextResponse.next();

  if (session !== expected) {
    // API routes get 401, page routes redirect to login
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = LOGIN_PATH;
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
