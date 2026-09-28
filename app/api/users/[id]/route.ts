import { supabaseAdmin } from "@/lib/supabase/client";
import { NextRequest, NextResponse } from "next/server";

// PATCH /api/users/[id] — update name or role
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json() as { fullName?: string; role?: "admin" | "employee" };

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

  // Also update auth metadata if name changed
  if (body.fullName) {
    await supabaseAdmin.auth.admin.updateUserById(id, {
      user_metadata: { full_name: body.fullName },
    });
  }

  return NextResponse.json({ ok: true });
}

// DELETE /api/users/[id] — remove user from Supabase Auth
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
