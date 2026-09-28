import { supabaseAdmin } from "@/lib/supabase/client";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { NextRequest, NextResponse } from "next/server";

// PATCH /api/users/[id] — update name or role (admin only)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await req.json() as { fullName?: string; role?: "admin" | "employee" };

  // Prevent demoting the last admin
  if (body.role === "employee") {
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("role", "admin");

    if ((profiles ?? []).length <= 1 && (profiles ?? [])[0]?.id === id) {
      return NextResponse.json({ error: "لا يمكن تغيير دور المدير الوحيد في النظام" }, { status: 400 });
    }
  }

  const updates: Record<string, string> = {};
  if (body.fullName) updates.full_name = body.fullName;
  if (body.role)     updates.role      = body.role;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "لا يوجد تحديث" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("profiles")
    .update(updates)
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (body.fullName) {
    await supabaseAdmin.auth.admin.updateUserById(id, {
      user_metadata: { full_name: body.fullName },
    });
  }

  return NextResponse.json({ ok: true });
}

// DELETE /api/users/[id] — remove user (admin only, can't delete last admin)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;

  // Check if target is the last admin
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", id)
    .single();

  if (profile?.role === "admin") {
    const { data: admins } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("role", "admin");

    if ((admins ?? []).length <= 1) {
      return NextResponse.json({ error: "لا يمكن حذف المدير الوحيد في النظام" }, { status: 400 });
    }
  }

  const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
