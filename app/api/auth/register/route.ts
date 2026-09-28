import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabase/client";
import { NextRequest, NextResponse } from "next/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CookieTuple = { name: string; value: string; options: any };

// POST /api/auth/register — create account then auto sign-in
export async function POST(req: NextRequest) {
  const { email, password, fullName } = await req.json() as {
    email:    string;
    password: string;
    fullName: string;
  };

  if (!email || !password || !fullName) {
    return NextResponse.json({ error: "الاسم والبريد وكلمة المرور مطلوبة" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" }, { status: 400 });
  }

  // Create user (admin API — no email confirmation required)
  const { data: { user }, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (createError) {
    const msg = createError.message.includes("already registered")
      ? "البريد الإلكتروني مستخدم بالفعل"
      : createError.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  // Upsert profile (trigger may run, but we set the name explicitly)
  if (user) {
    // Self-registration always gets 'employee' — role can only be changed by an admin
    await supabaseAdmin.from("profiles").upsert({
      id:        user.id,
      email,
      full_name: fullName,
      role:      "employee",
    }, { onConflict: "id" });
  }

  // Now sign in to get session cookies
  const collected: CookieTuple[] = [];
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookiesToSet) => { cookiesToSet.forEach((c) => collected.push(c)); },
      },
    }
  );

  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) {
    return NextResponse.json({ error: "تم إنشاء الحساب، لكن فشل تسجيل الدخول التلقائي. سجّل دخولك يدوياً." }, { status: 500 });
  }

  const res = NextResponse.json({ ok: true });
  collected.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
  return res;
}
