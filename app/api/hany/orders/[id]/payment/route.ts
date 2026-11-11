import { NextRequest } from "next/server";
import { hany, HanyError } from "@/lib/hany/client";
import { hanyHandle, logHanyOrder } from "@/lib/hany/route";
import { HANY_PAYMENT, NEXT_PAYMENT } from "@/lib/hany/labels";
import type { HanyPaymentStatus } from "@/lib/hany/types";

// POST /api/hany/orders/HNY-100001/payment — { status, reference? }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return hanyHandle(async () => {
    const body = await req.json().catch(() => ({}));
    const status = body.status as HanyPaymentStatus;
    if (!(status in HANY_PAYMENT)) throw new HanyError(422, "invalid", "حالة دفع غير معروفة");

    const current = (await hany.order(id)).data;
    if (!NEXT_PAYMENT[current.payment_status].includes(status)) {
      throw new HanyError(409, "invalid_transition",
        `مينفعش الدفع يتحول من «${HANY_PAYMENT[current.payment_status].label}» لـ «${HANY_PAYMENT[status].label}»`);
    }

    const reference = typeof body.reference === "string" && body.reference.trim() ? body.reference.trim().slice(0, 200) : undefined;
    const order = (await hany.setPayment(id, { status, reference })).data;
    await logHanyOrder(order.order_number, "status",
      `غيّر دفع طلب HANY ${order.order_number} لـ «${HANY_PAYMENT[status].label}»`, { from: current.payment_status, to: status });
    return { order };
  });
}
