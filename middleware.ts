import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

const LOGIN_PATH = "/login";

function isPublic(pathname: string): boolean {
  return (
    pathname === LOGIN_PATH ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/webhooks/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon")
  );
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();

  const needsAuth =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/api/");

  if (!needsAuth) return NextResponse.next();

  // Build a mutable response so Supabase can refresh tokens into cookies
  let supabaseResponse = NextResponse.next({ request: req });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request: req });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() validates the JWT and refreshes the token if needed
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = LOGIN_PATH;
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
