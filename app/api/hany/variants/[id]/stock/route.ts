import { NextRequest } from "next/server";
import { hany, HanyError } from "@/lib/hany/client";
import { hanyHandle, logHanyInventory } from "@/lib/hany/route";

// PATCH /api/hany/variants/<variant id>/stock — { set } or { adjust, reason? }
// (adjust is relative, so it stays right while orders come in)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return hanyHandle(async () => {
    const body = await req.json().catch(() => ({}));
    const label = typeof body.label === "string" ? body.label.slice(0, 200) : id;

    if (body.set !== undefined) {
      const set = Number(body.set);
      if (!Number.isInteger(set) || set < 0 || set > 100_000) throw new HanyError(422, "invalid", "الكمية لازم رقم صحيح من 0");
      const r = await hany.setStock(id, { set });
      await logHanyInventory("hany_stock", `خلّى مخزون ${label} على HANY = ${set}`, { variant_id: id, set });
      return { result: r.data };
    }

    const adjust = Number(body.adjust);
    if (!Number.isInteger(adjust) || adjust === 0 || Math.abs(adjust) > 100_000) throw new HanyError(422, "invalid", "التعديل لازم رقم صحيح");
    const reason = typeof body.reason === "string" && body.reason.trim() ? body.reason.trim().slice(0, 200) : "XENO";
    const r = await hany.setStock(id, { adjust, reason });
    await logHanyInventory("hany_stock", `${adjust > 0 ? "زوّد" : "نقّص"} مخزون ${label} على HANY بـ ${Math.abs(adjust)}`, { variant_id: id, adjust });
    return { result: r.data };
  });
}
