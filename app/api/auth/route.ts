import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "xeno_session";
const ONE_YEAR = 60 * 60 * 24 * 365;

export async function POST(req: NextRequest) {
  const { password } = await req.json();
  const adminPassword = process.env.XENO_ADMIN_PASSWORD;

  if (!adminPassword) {
    return NextResponse.json({ error: "Auth not configured" }, { status: 503 });
  }

  if (!password || password !== adminPassword) {
    return NextResponse.json({ error: "كلمة المرور غلط" }, { status: 401 });
  }

  const sessionSecret = process.env.XENO_SESSION_SECRET;
  if (!sessionSecret) {
    return NextResponse.json({ error: "Session secret not configured" }, { status: 503 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, sessionSecret, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge:   ONE_YEAR,
    path:     "/",
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { maxAge: 0, path: "/" });
  return res;
}
