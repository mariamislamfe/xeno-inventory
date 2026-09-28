import { supabaseAdmin } from "@/lib/supabase/client";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { NextRequest, NextResponse } from "next/server";

export const revalidate = 0;

// GET /api/users — list all users (admin only)
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, role");

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  const list = (users ?? []).map((u) => {
    const p = profileMap.get(u.id);
    return {
      id:         u.id,
      email:      u.email ?? "",
      fullName:   p?.full_name ?? u.email?.split("@")[0] ?? "—",
      role:       (p?.role as string) ?? "employee",
      createdAt:  u.created_at,
      lastSignIn: u.last_sign_in_at ?? null,
    };
  });

  return NextResponse.json({ users: list });
}

// POST /api/users — create a new user (admin only)
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { email, password, fullName, role } = await req.json() as {
    email:    string;
    password: string;
    fullName: string;
    role:     "admin" | "employee";
  };

  if (!email || !password || !fullName) {
    return NextResponse.json({ error: "البريد والاسم وكلمة المرور مطلوبة" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" }, { status: 400 });
  }

  const { data: { user }, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (error) {
    const msg = error.message.includes("already registered")
      ? "البريد الإلكتروني مستخدم بالفعل"
      : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  if (user) {
    await supabaseAdmin.from("profiles").upsert({
      id:        user.id,
      email,
      full_name: fullName,
      role:      role ?? "employee",
    }, { onConflict: "id" });
  }

  return NextResponse.json({ ok: true, userId: user?.id }, { status: 201 });
}
