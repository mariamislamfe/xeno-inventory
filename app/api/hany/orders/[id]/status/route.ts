import { NextRequest } from "next/server";
import { hany, HanyError } from "@/lib/hany/client";
import { hanyHandle, logHanyOrder } from "@/lib/hany/route";
import { HANY_STATUS, NEXT_STATUS } from "@/lib/hany/labels";
import type { HanyOrderStatus } from "@/lib/hany/types";

// POST /api/hany/orders/HNY-100001/status — { status, note? }
// Cancelling puts the items back in HANY stock (HANY does that).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return hanyHandle(async () => {
    const body = await req.json().catch(() => ({}));
    const status = body.status as HanyOrderStatus;
    if (!(status in HANY_STATUS)) throw new HanyError(422, "invalid", "حالة غير معروفة");

    const current = (await hany.order(id)).data;
    if (!NEXT_STATUS[current.status].includes(status)) {
      throw new HanyError(409, "invalid_transition",
        `مينفعش الطلب يتحول من «${HANY_STATUS[current.status].label}» لـ «${HANY_STATUS[status].label}»`);
    }

    const note  = typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 500) : "From XENO";
    const order = (await hany.setStatus(id, { status, note })).data;
    await logHanyOrder(order.order_number, "status",
      `غيّر حالة طلب HANY ${order.order_number} لـ «${HANY_STATUS[status].label}»`, { from: current.status, to: status });
    return { order };
  });
}
