import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CookieTuple = { name: string; value: string; options: any };

function makeSupabaseClient(req: NextRequest, collected: CookieTuple[]) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookiesToSet) => { cookiesToSet.forEach((c) => collected.push(c)); },
      },
    }
  );
}

function applyCollected(res: NextResponse, collected: CookieTuple[]) {
  collected.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
}

// POST /api/auth — sign in with email + password
export async function POST(req: NextRequest) {
  const { email, password } = await req.json() as { email: string; password: string };

  if (!email || !password) {
    return NextResponse.json({ error: "البريد الإلكتروني وكلمة المرور مطلوبان" }, { status: 400 });
  }

  const collected: CookieTuple[] = [];
  const supabase = makeSupabaseClient(req, collected);

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return NextResponse.json({ error: "البريد الإلكتروني أو كلمة المرور غلط" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  applyCollected(res, collected);
  return res;
}

// DELETE /api/auth — sign out
export async function DELETE(req: NextRequest) {
  const collected: CookieTuple[] = [];
  const supabase = makeSupabaseClient(req, collected);

  await supabase.auth.signOut();

  const res = NextResponse.json({ ok: true });
  applyCollected(res, collected);
  return res;
}
