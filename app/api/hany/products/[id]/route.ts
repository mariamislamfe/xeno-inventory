import { NextRequest } from "next/server";
import { hany, HanyError } from "@/lib/hany/client";
import { hanyHandle, logHanyInventory } from "@/lib/hany/route";

// PATCH /api/hany/products/<id> — only these fields can be changed from XENO
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return hanyHandle(async () => {
    const body = await req.json().catch(() => ({}));
    const patch: Record<string, unknown> = {};

    if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim().slice(0, 200);
    if (typeof body.is_published === "boolean") patch.is_published = body.is_published;
    for (const k of ["base_price", "compare_at_price"] as const) {
      if (body[k] === null && k === "compare_at_price") patch[k] = null;
      else if (body[k] !== undefined) {
        const n = Number(body[k]);
        if (!Number.isFinite(n) || n < 0 || n > 1_000_000) throw new HanyError(422, "invalid", "سعر غير صالح");
        patch[k] = n;
      }
    }
    if (Object.keys(patch).length === 0) throw new HanyError(422, "invalid", "مفيش تعديل");

    const product = (await hany.updateProduct(id, patch)).data;
    const what = patch.is_published !== undefined ? (patch.is_published ? "نشر" : "أخفى") : "عدّل";
    await logHanyInventory("hany_product", `${what} منتج HANY «${product.name}»`, { product_id: product.id, patch });
    return { product };
  });
}
