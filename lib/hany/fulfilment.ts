// Server-only: J&T shipping, waybill data and WhatsApp for HANY orders — the same flow
// Shopify orders get, with HANY as the source of the order. The shared shipping /
// label / WhatsApp routes call into here when they see a HANY number (lib/hany/ids).
// To the customer everything says XENO; inside the dashboard the order says HANY.
import { supabaseAdmin } from "@/lib/supabase/client";
import { createJTOrder, type JTItem } from "@/lib/jt/client";
import { resolveJTAddress } from "@/lib/jt/address";
import { saveShipment } from "@/lib/shipments";
import { logOrderAction } from "@/lib/audit";
import { toLocal } from "@/lib/phone";
import type { LabelItem, LabelReceiver } from "@/lib/label-items";
import { hany, HanyError } from "./client";
import { hanyId, hanyOrderNumber } from "./ids";
import { NEXT_STATUS } from "./labels";
import type { HanyOrder, HanyOrderStatus } from "./types";

// Marks HANY history entries written by XENO (the HANY webhook skips logging those twice)
export const FROM_XENO = "From XENO";

function street(o: HanyOrder) {
  const s = o.shipping ?? { address: null, building: null, area: null, city: null };
  return [s.address, s.building].filter(Boolean).join("، ");
}
function area(o: HanyOrder) {
  const a = o.shipping?.area;
  return a && a !== "All areas" ? a : "";
}
function items(o: HanyOrder): JTItem[] {
  return (o.items ?? []).map((i) => ({
    name: i.name, qty: i.quantity, sku: i.sku ?? "", variant: [i.color, i.size].filter(Boolean).join(" / "),
  }));
}
// What J&T collects: nothing when paid online, otherwise the order total
function toCollect(o: HanyOrder) {
  return o.payment_status === "paid" || o.payment_status === "refunded" ? 0 : o.totals.total;
}

/** Move a HANY order forward one allowed step at a time until it reaches `target`. */
// Returns the updated order, or null when it was already past `target` (or cancelled).
const PATH: HanyOrderStatus[] = ["pending", "confirmed", "processing", "shipped", "delivered"];
export async function advanceHanyStatus(orderNumber: string, target: Exclude<HanyOrderStatus, "cancelled">, note: string): Promise<HanyOrder | null> {
  let o = (await hany.order(orderNumber)).data;
  const goal = PATH.indexOf(target);
  for (let at = PATH.indexOf(o.status); at >= 0 && at < goal; at = PATH.indexOf(o.status)) {
    const next = PATH[at + 1];
    if (!NEXT_STATUS[o.status].includes(next)) break;
    o = (await hany.setStatus(orderNumber, { status: next, note: `${FROM_XENO} — ${note}` })).data;
  }
  return o.status === target ? o : null;
}

export interface ShipResult {
  order_number:   string;
  ok:             boolean;
  trackingNumber: string | undefined;
  error:          string | undefined;
  skipped:        boolean;
}

/** Ship one HANY order on J&T (same rules as /api/confirmation/ship for Shopify). */
export async function shipHanyOrder(input: { shopify_order_id: number | string; order_number?: string }): Promise<ShipResult> {
  const id  = Number(input.shopify_order_id);
  const num = input.order_number || hanyOrderNumber(id);
  const fail = (error: string): ShipResult => ({ order_number: num, ok: false, trackingNumber: undefined, error, skipped: false });

  // Shipped already → never a second J&T order
  const { data: existing } = await supabaseAdmin
    .from("shipments").select("tracking_number")
    .eq("shopify_order_id", id).not("tracking_number", "is", null).limit(1).maybeSingle();
  if (existing?.tracking_number) {
    return { order_number: num, ok: true, trackingNumber: existing.tracking_number, error: undefined, skipped: true };
  }

  // Fresh order from HANY: never ship from what the page showed
  let o: HanyOrder;
  try {
    o = (await hany.order(num)).data;
  } catch (err) {
    return fail(err instanceof HanyError && err.status === 404 ? "الطلب ده مش موجود على HANY — حدّثي الصفحة" : `تعذر جلب الطلب من HANY — ${String(err instanceof Error ? err.message : err)}`);
  }
  if (o.status === "cancelled") return fail("الطلب ملغي على HANY");
  if (o.status === "shipped" || o.status === "delivered") return fail("الطلب ده متعلّم «اتشحن» على HANY بالفعل");

  // J&T won't reuse an order id: a re-ship after a cancelled shipment gets "HNY-100001-2"
  const { data: cancels } = await supabaseAdmin
    .from("activity_log").select("id")
    .eq("type", "shipment").eq("action", "cancelled").contains("metadata", { order_number: o.order_number });
  const attempt      = (cancels?.length ?? 0) + 1;
  const txlogisticId = attempt > 1 ? `${o.order_number}-${attempt}` : o.order_number;

  const city = area(o) || o.shipping?.city || "";
  const jt = await createJTOrder({
    txlogisticId,
    orderNumber:  o.order_number,
    customerName: o.customer?.name ?? "",
    phone:        o.customer?.phone ?? "",
    address:      street(o) || city,
    city,
    governorate:  o.shipping?.city ?? "",
    items:        items(o),
    totalAmount:  o.totals.total,
    codAmount:    toCollect(o),
    note:         o.notes ?? undefined,
  });

  const saveErr = await saveShipment({
    shopify_order_id: id,
    order_number:     o.order_number,
    customer_name:    o.customer?.name ?? null,
    phone:            o.customer?.phone ?? null,
    provider:         "J&T Express",
    status:           "pending",
    tracking_number:  jt.trackingNumber ?? null,
    cod_amount:       toCollect(o) || o.totals.total,
    address:          street(o) || null,
    city:             city || null,
    governorate:      o.shipping?.city ?? null,
    notes:            txlogisticId,
  });
  if (saveErr) console.error("[hany ship] shipments save error:", o.order_number, saveErr);

  if (jt.ok && jt.trackingNumber) {
    await sendTrackingWhatsApp(o.customer?.phone ?? "", o.customer?.name ?? "", jt.trackingNumber);
    await logOrderAction(id, "ship", `شحن ${o.order_number} (HANY) على J&T — ${jt.trackingNumber}`,
      { tracking_number: jt.trackingNumber, txlogisticId, source: "hany", order_number: o.order_number });
    // On HANY: بيتجهز now; the J&T status sync moves it to اتشحن / اتسلم
    await advanceHanyStatus(o.order_number, "processing", `J&T ${jt.trackingNumber}`).catch((e) =>
      console.error("[hany ship] status update failed:", o.order_number, e));
  }

  return { order_number: o.order_number, ok: jt.ok, trackingNumber: jt.trackingNumber, error: jt.error, skipped: false };
}

/** Items + receiver printed under the waybill (same shape as lib/label-items for Shopify). */
export async function hanyLabelData(id: number): Promise<{ items: LabelItem[]; receiver: LabelReceiver | null }> {
  try {
    const o = (await hany.order(hanyOrderNumber(id))).data;
    const city = area(o) || o.shipping?.city || "";
    const jt = resolveJTAddress({ governorate: o.shipping?.city ?? "", city, address: street(o) });
    return {
      items: (o.items ?? []).map((i) => ({ qty: i.quantity, name: i.name, sku: i.sku ?? "", color: i.color ?? "", size: i.size ?? "" })),
      receiver: {
        name:   o.customer?.name ?? "",
        phone:  toLocal(o.customer?.phone ?? ""),
        street: street(o),
        place:  jt.ok ? [jt.area, jt.city, jt.prov].filter(Boolean).join("، ") : [city, o.shipping?.city].filter(Boolean).join("، "),
      },
    };
  } catch {
    return { items: [], receiver: null };
  }
}

/** After the J&T status sync: picked up → اتشحن, delivered → اتسلم on HANY. Best-effort. */
export async function pushHanyShipmentStatus(changes: { shopify_order_id: number; order_number: string | null; status: string }[]) {
  for (const c of changes) {
    const target: HanyOrderStatus | null =
      c.status === "delivered" ? "delivered"
      : ["picked_up", "in_transit", "out_for_delivery"].includes(c.status) ? "shipped"
      : null;
    if (!target) continue;
    const num = c.order_number || hanyOrderNumber(c.shopify_order_id);
    try {
      const o = await advanceHanyStatus(num, target, `J&T: ${c.status}`);
      if (o) await logOrderAction(hanyId(num), "status", `J&T حدّث طلب HANY ${num} لـ «${target === "delivered" ? "اتسلم" : "اتشحن"}»`,
        { source: "hany", order_number: num }, { id: null, name: "J&T" });
    } catch (e) {
      console.error("[hany sync] status push failed:", num, e);
    }
  }
}

/** Customer answered the confirmation poll on WhatsApp → confirm or cancel on HANY. */
export async function applyHanyWhatsAppReply(id: number, confirmed: boolean, detail: string) {
  const num = hanyOrderNumber(id);
  try {
    const current = (await hany.order(num)).data;
    if (confirmed && current.status === "pending") {
      await hany.setStatus(num, { status: "confirmed", note: `${FROM_XENO} — WhatsApp` });
    } else if (!confirmed && NEXT_STATUS[current.status].includes("cancelled")) {
      await hany.setStatus(num, { status: "cancelled", note: `${FROM_XENO} — WhatsApp` });
    }
    const notes = current.internal_notes ? `${current.internal_notes}\n---\n${detail}` : detail;
    await hany.updateOrder(num, { internal_notes: notes.slice(0, 5000) });
  } catch (e) {
    console.error("[whatsapp-reply] HANY update failed:", num, e);
  }
}

// ── WhatsApp (the same bot and messages as Shopify orders; the customer sees XENO) ──

/** Order confirmation with the confirm / cancel poll, once per order. */
export async function sendHanyConfirmation(o: HanyOrder) {
  const waUrl    = process.env.WA_SERVICE_URL;
  const waSecret = process.env.WA_SECRET;
  const phone    = o.customer?.phone ?? "";
  if (!waUrl || !waSecret || !phone) return;

  const id = hanyId(o.order_number);
  const { data: already } = await supabaseAdmin
    .from("whatsapp_messages").select("id")
    .eq("shopify_order_id", id).eq("template", "order_confirmation").limit(1);
  if (already?.length) return;

  const itemsText = (o.items ?? [])
    .map((i) => `   • ${i.name}${i.color || i.size ? ` (${[i.color, i.size].filter(Boolean).join(" / ")})` : ""} × ${i.quantity}`)
    .join("\n");
  const address   = [street(o), area(o), o.shipping?.city].filter(Boolean).join(" - ");
  const firstName = (o.customer?.name ?? "").split(" ")[0];

  const message =
    `👋 أهلاً ${firstName}!\n` +
    `شكراً لاختيارك *XENO* 🖤\n\n` +
    `━━━━━━━━━━━━━━\n` +
    `🛒 *تفاصيل طلبك:*\n` +
    `━━━━━━━━━━━━━━\n` +
    `🔢 رقم الطلب: *${o.order_number}*\n` +
    `📍 العنوان: ${address || "—"}\n` +
    `📞 الهاتف: ${phone}\n\n` +
    `🛍️ *المنتجات:*\n${itemsText}\n\n` +
    `💰 *الإجمالي: ${o.totals.total.toLocaleString("en-US")} ج.م*\n` +
    `🚚 الشحن عبر J&T Express خلال 2-3 أيام\n` +
    `━━━━━━━━━━━━━━\n\n` +
    `اختار من الاستطلاع اللي تحت 👇 لتأكيد الطلب أو إلغائه\n\n` +
    `_فريق XENO في خدمتك دائماً_ 🖤`;

  let ok = false;
  try {
    const res  = await fetch(`${waUrl}/send`, {
      signal:  AbortSignal.timeout(15_000),
      method:  "POST",
      headers: { "Content-Type": "application/json", "x-wa-secret": waSecret },
      body:    JSON.stringify({
        phone, message,
        order: { shopify_order_id: id, order_number: o.order_number, customer_name: o.customer?.name ?? "" },
      }),
    });
    ok = Boolean((await res.json().catch(() => ({})))?.ok);
  } catch (err) {
    console.error("[webhook/hany] WhatsApp send failed:", err);
  }

  await supabaseAdmin.from("whatsapp_messages").insert({
    shopify_order_id: id,
    order_number:     o.order_number,
    phone,
    customer_name:    o.customer?.name ?? "",
    template:         "order_confirmation",
    status:           ok ? "sent" : "failed",
  });
}

async function sendTrackingWhatsApp(phone: string, customerName: string, trackingNumber: string) {
  const waUrl    = process.env.WA_SERVICE_URL;
  const waSecret = process.env.WA_SECRET;
  if (!waUrl || !waSecret || !phone) return;
  try {
    await fetch(`${waUrl}/send-tracking`, {
      method:  "POST",
      signal:  AbortSignal.timeout(8_000),
      headers: { "Content-Type": "application/json", "x-wa-secret": waSecret },
      body:    JSON.stringify({ phone, customer_name: customerName, tracking_number: trackingNumber }),
    });
  } catch (e) {
    console.error("[hany ship] WA tracking send error:", e);
  }
}
