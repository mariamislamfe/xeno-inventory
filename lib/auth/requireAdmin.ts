import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/client";
import { NextResponse } from "next/server";

type AdminOk  = { ok: true;  userId: string };
type AdminErr = { ok: false; response: NextResponse };

export async function requireAdmin(): Promise<AdminOk | AdminErr> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return { ok: false, response: NextResponse.json({ error: "يجب تسجيل الدخول أولاً" }, { status: 401 }) };
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return { ok: false, response: NextResponse.json({ error: "هذا الإجراء يتطلب صلاحيات مدير" }, { status: 403 }) };
    }

    return { ok: true, userId: user.id };
  } catch {
    return { ok: false, response: NextResponse.json({ error: "خطأ في التحقق من الصلاحيات" }, { status: 500 }) };
  }
}

// Returns the current user's role — used for role-aware UI decisions
export async function getCurrentUserRole(): Promise<"admin" | "employee" | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    return (profile?.role as "admin" | "employee") ?? "employee";
  } catch {
    return null;
  }
}
