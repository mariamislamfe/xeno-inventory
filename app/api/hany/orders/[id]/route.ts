import { NextRequest } from "next/server";
import { hany, HanyError } from "@/lib/hany/client";
import { hanyHandle, logHanyOrder } from "@/lib/hany/route";
import { hanyId } from "@/lib/hany/ids";
import { orderHistory } from "@/lib/audit";
import { supabaseAdmin } from "@/lib/supabase/client";

export const revalidate = 0;

// GET /api/hany/orders/HNY-100001 — the full HANY order + its J&T shipment + the team's history
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return hanyHandle(async () => {
    const order = (await hany.order(id)).data;
    const num   = hanyId(order.order_number);
    const [{ data: shipment }, history] = await Promise.all([
      supabaseAdmin.from("shipments")
        .select("tracking_number, status, label_printed, provider")
        .eq("shopify_order_id", num).not("tracking_number", "is", null).limit(1).maybeSingle(),
      orderHistory(num),
    ]);
    return { order, shipment: shipment ?? null, history };
  });
}

// PATCH /api/hany/orders/HNY-100001 — { internal_notes }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return hanyHandle(async () => {
    const body = await req.json().catch(() => ({}));
    if (typeof body.internal_notes !== "string" || body.internal_notes.length > 5000) {
      throw new HanyError(422, "invalid", "الملاحظة لازم تبقى نص (أقل من 5000 حرف)");
    }
    const order = (await hany.updateOrder(id, { internal_notes: body.internal_notes })).data;
    await logHanyOrder(order.order_number, "edit", `عدّل الملاحظات الداخلية لطلب HANY ${order.order_number}`);
    return { order };
  });
}
