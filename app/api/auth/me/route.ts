import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/client";
import { NextResponse } from "next/server";

export const revalidate = 0;

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, role")
      .eq("id", user.id)
      .single();

    return NextResponse.json({
      user: {
        id:       user.id,
        email:    user.email ?? "",
        fullName: profile?.full_name ?? user.email?.split("@")[0] ?? "مستخدم",
        role:     (profile?.role as string) ?? "employee",
      },
    });
  } catch {
    return NextResponse.json({ user: null }, { status: 500 });
  }
}
