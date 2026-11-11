// Public endpoint the HANY store posts events to (middleware keeps /api/webhooks/* open).
// Nothing here touches Shopify: events become activity_log rows (notifications + log),
// webhook_log rows (shop = 'hany') and, for a new order, the WhatsApp confirmation.
import { NextRequest, NextResponse, after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/client";
import { verifyHanySignature } from "@/lib/hany/client";
import { hanyId } from "@/lib/hany/ids";
import { sendHanyConfirmation } from "@/lib/hany/fulfilment";
import { HANY_PAYMENT, HANY_STATUS } from "@/lib/hany/labels";
import type { HanyOrder, HanyProduct } from "@/lib/hany/types";

export const maxDuration = 30;

interface HanyEvent { id: string; type: string; created_at: string; data: unknown }

export async function POST(req: NextRequest) {
  const secret = process.env.HANY_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "HANY webhook not configured" }, { status: 503 });

  // Raw body first: the signature covers the exact bytes
  const raw = await req.text();
  if (!verifyHanySignature(raw, req.headers.get("hany-signature") ?? "", secret)) {
    console.error("[webhook/hany] bad signature");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let event: HanyEvent;
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const eventId = String(event.id ?? req.headers.get("hany-delivery") ?? "");
  const type    = String(event.type ?? req.headers.get("hany-event") ?? "");

  // HANY wants a 2xx within 8 seconds: answer now, work right after
  after(async () => {
    // Retried deliveries carry the same id: handle each event once
    if (eventId) {
      const { data: seen } = await supabaseAdmin
        .from("webhook_log").select("id").eq("shop", "hany").eq("payload->>id", eventId).limit(1);
      if (seen?.length) return;
    }

    let processed = false;
    let errorMsg: string | null = null;
    try {
      await handle(type, event.data);
      processed = true;
    } catch (err) {
      errorMsg = String(err);
      console.error("[webhook/hany] handler error:", errorMsg);
    }

    const d = event.data as { order_number?: string; status?: string; payment_status?: string; name?: string; sku?: string } | null;
    await supabaseAdmin.from("webhook_log").insert({
      topic:   type,
      shop:    "hany",
      payload: processed
        ? { id: eventId, order_number: d?.order_number, status: d?.status, payment_status: d?.payment_status, name: d?.name, sku: d?.sku }
        : { id: eventId, event },
      processed,
      error: errorMsg,
    });
  });

  return NextResponse.json({ ok: true });
}

function log(row: { type: string; action: string; detail: string; entity_id: string; metadata?: Record<string, unknown> }) {
  return supabaseAdmin.from("activity_log").insert({ ...row, user_name: "HANY", metadata: { ...row.metadata, source: "hany" } })
    .then(({ error }) => { if (error) throw new Error(error.message); });
}

// A change XENO made itself already has its own log row (under the user who did it)
function madeFromXeno(o: HanyOrder) {
  const last = o.history?.[o.history.length - 1];
  return Boolean(last?.note && /from xeno/i.test(last.note));
}

async function handle(type: string, data: unknown) {
  switch (type) {
    case "ping":
      return log({ type: "system", action: "hany_ping", detail: "HANY: تجربة ربط ناجحة", entity_id: "hany" });

    case "order.created": {
      const o = data as HanyOrder;
      await log({
        type: "order", action: "create", entity_id: String(hanyId(o.order_number)),
        detail: `طلب جديد ${o.order_number} من ${o.customer?.name ?? "عميل"} — موقع HANY`,
        metadata: { order_number: o.order_number, total: o.totals?.total, phone: o.customer?.phone, items: o.items?.length },
      });
      // Same WhatsApp confirmation (with the confirm / cancel poll) Shopify orders get
      return sendHanyConfirmation(o);
    }

    case "order.status_changed": {
      const o = data as HanyOrder;
      if (madeFromXeno(o)) return;
      return log({
        type: "order", action: o.status === "cancelled" ? "cancel" : "update", entity_id: String(hanyId(o.order_number)),
        detail: `HANY: الطلب ${o.order_number} بقى «${HANY_STATUS[o.status]?.label ?? o.status}»`,
        metadata: { order_number: o.order_number, status: o.status },
      });
    }

    case "order.payment_changed": {
      const o = data as HanyOrder;
      if (madeFromXeno(o)) return;
      return log({
        type: "order", action: o.payment_status === "paid" ? "paid" : "update", entity_id: String(hanyId(o.order_number)),
        detail: `HANY: دفع الطلب ${o.order_number} بقى «${HANY_PAYMENT[o.payment_status]?.label ?? o.payment_status}»`,
        metadata: { order_number: o.order_number, payment_status: o.payment_status, total: o.totals?.total },
      });
    }

    case "product.created":
    case "product.updated": {
      const p = data as HanyProduct;
      return log({
        type: "inventory", action: "hany_product", entity_id: "hany",
        detail: `HANY: ${type === "product.created" ? "منتج جديد" : "اتعدل منتج"} «${p.name}»`,
        metadata: { product_id: p.id },
      });
    }

    case "product.deleted":
      return log({ type: "inventory", action: "hany_product", entity_id: "hany",
        detail: "HANY: اتمسح منتج", metadata: { product_id: (data as { id?: string })?.id } });

    case "inventory.updated": {
      const v = data as { sku?: string; color?: string; size?: string; stock?: number };
      return log({ type: "inventory", action: "hany_stock", entity_id: "hany",
        detail: `HANY: مخزون ${v.sku ?? ""} بقى ${v.stock ?? "?"}`, metadata: v });
    }

    default:
      return; // unknown events are only recorded in webhook_log
  }
}
