import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase/client";
import { normalizeOrder } from "@/lib/shopify/orders";
import type { ShopifyOrderRaw } from "@/lib/shopify/orders";

// Shopify signs each webhook with HMAC-SHA256 using the client secret
function verifyHmac(rawBody: string, hmacHeader: string): boolean {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!secret) return false;
  const computed = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("base64");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(computed, "base64"),
      Buffer.from(hmacHeader, "base64"),
    );
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  // Must read raw body before any parsing for HMAC to work
  const rawBody = await req.text();
  const hmac    = req.headers.get("x-shopify-hmac-sha256") ?? "";
  const topic   = req.headers.get("x-shopify-topic") ?? "";
  const shop    = req.headers.get("x-shopify-shop-domain") ?? "";

  if (!verifyHmac(rawBody, hmac)) {
    console.error("[webhook] HMAC verification failed for topic:", topic);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let processed = false;
  let errorMsg: string | null = null;

  try {
    await handleTopic(topic, payload);
    processed = true;
  } catch (err) {
    errorMsg = String(err);
    console.error("[webhook] handler error:", errorMsg);
  }

  // Always log — even on handler failure. Keep only a summary unless it failed:
  // full order payloads (~8 KB each) would fill the database within months.
  const p = payload as { id?: number; name?: string; financial_status?: string; fulfillment_status?: string };
  await supabaseAdmin.from("webhook_log").insert({
    topic,
    shop,
    payload:   processed ? { id: p?.id, name: p?.name, financial_status: p?.financial_status, fulfillment_status: p?.fulfillment_status } : payload,
    processed,
    error: errorMsg,
  });

  // Shopify requires 200 quickly — don't block on logging errors
  return NextResponse.json({ ok: true });
}

// ── Topic handlers ────────────────────────────────────────────────────────

async function handleTopic(topic: string, payload: unknown) {
  switch (topic) {
    case "orders/create":
      await onOrderCreate(payload as ShopifyOrderRaw);
      break;
    case "orders/updated":
      await onOrderUpdated(payload as ShopifyOrderRaw);
      break;
    case "orders/cancelled":
      await onOrderCancelled(payload as ShopifyOrderRaw);
      break;
    case "orders/paid":
      await onOrderPaid(payload as ShopifyOrderRaw);
      break;
    default:
      // Unknown topic — logged but not processed
      break;
  }
}

async function onOrderCreate(raw: ShopifyOrderRaw) {
  const order = normalizeOrder(raw);

  // Log to activity
  await supabaseAdmin.from("activity_log").insert({
    type:      "order",
    action:    "create",
    detail:    `طلب جديد #${order.orderNumber} من ${order.customerName}`,
    entity_id: String(order.shopifyId),
    user_name: "Shopify",
    metadata:  {
      total:          order.total,
      status:         order.status,
      payment_status: order.paymentStatus,
      phone:          order.customerPhone,
      city:           order.city,
    },
  });

  // Send WhatsApp confirmation if service is configured
  if (order.customerPhone) {
    await sendWhatsApp(raw, order);
  }
}

async function sendWhatsApp(raw: ShopifyOrderRaw, order: ReturnType<typeof normalizeOrder>) {
  const waUrl    = process.env.WA_SERVICE_URL;
  const waSecret = process.env.WA_SECRET;
  if (!waUrl || !waSecret) return;

  // Shopify retries webhooks (and merges/re-creates fire orders/create again):
  // only one confirmation message per order
  const { data: already } = await supabaseAdmin
    .from("whatsapp_messages")
    .select("id")
    .eq("shopify_order_id", order.shopifyId)
    .eq("template", "order_confirmation")
    .limit(1);
  if (already?.length) return;

  // Build items list
  const itemsText = order.items
    .map((i) => `   • ${i.productName}${i.variant ? ` (${i.variant})` : ""} × ${i.quantity}`)
    .join("\n");

  const address = [order.address, order.city, order.governorate].filter(Boolean).join(" - ");
  const firstName = order.customerName.split(" ")[0];

  const message =
    `👋 أهلاً ${firstName}!\n` +
    `شكراً لاختيارك *XENO* 🖤\n\n` +
    `━━━━━━━━━━━━━━\n` +
    `🛒 *تفاصيل طلبك:*\n` +
    `━━━━━━━━━━━━━━\n` +
    `🔢 رقم الطلب: *#${order.orderNumber}*\n` +
    `📍 العنوان: ${address || "—"}\n` +
    `📞 الهاتف: ${order.customerPhone}\n\n` +
    `🛍️ *المنتجات:*\n${itemsText}\n\n` +
    `💰 *الإجمالي: ${order.total.toLocaleString("en-US")} ج.م*\n` +
    `🚚 الشحن عبر J&T Express خلال 2-3 أيام\n` +
    `━━━━━━━━━━━━━━\n\n` +
    `اختار من الاستطلاع اللي تحت 👇 لتأكيد الطلب أو إلغائه\n\n` +
    `_فريق XENO في خدمتك دائماً_ 🖤`;

  try {
    const res  = await fetch(`${waUrl}/send`, {
      signal: AbortSignal.timeout(4000),   // Shopify gives webhooks ~5s before retrying
      method: "POST",
      headers: { "Content-Type": "application/json", "x-wa-secret": waSecret },
      body: JSON.stringify({
        phone:   order.customerPhone,
        message,
        order: {
          shopify_order_id: order.shopifyId,
          order_number:     order.orderNumber,
          customer_name:    order.customerName,
        },
      }),
    });
    const data = await res.json();

    await supabaseAdmin.from("whatsapp_messages").insert({
      shopify_order_id: order.shopifyId,
      order_number:     order.orderNumber,
      phone:            order.customerPhone,
      customer_name:    order.customerName,
      template:         "order_confirmation",
      status:           data.ok ? "sent" : "failed",
    });
  } catch (err) {
    console.error("[webhook] WhatsApp send failed:", err);
  }
}

async function onOrderUpdated(raw: ShopifyOrderRaw) {
  const order = normalizeOrder(raw);
  await supabaseAdmin.from("activity_log").insert({
    type:      "order",
    action:    "update",
    detail:    `تحديث طلب #${order.orderNumber} — ${order.customerName}`,
    entity_id: String(order.shopifyId),
    user_name: "Shopify",
    metadata:  {
      status:         order.status,
      payment_status: order.paymentStatus,
      tracking:       order.trackingNumber,
    },
  });
}

async function onOrderCancelled(raw: ShopifyOrderRaw) {
  const order = normalizeOrder(raw);
  await supabaseAdmin.from("activity_log").insert({
    type:      "order",
    action:    "cancel",
    detail:    `إلغاء طلب #${order.orderNumber} — ${order.customerName}`,
    entity_id: String(order.shopifyId),
    user_name: "Shopify",
    metadata:  { total: order.total },
  });
}

async function onOrderPaid(raw: ShopifyOrderRaw) {
  const order = normalizeOrder(raw);
  await supabaseAdmin.from("activity_log").insert({
    type:      "order",
    action:    "paid",
    detail:    `تم الدفع للطلب #${order.orderNumber} — ${order.total.toLocaleString("en-US")} ج.م`,
    entity_id: String(order.shopifyId),
    user_name: "Shopify",
    metadata:  { total: order.total, phone: order.customerPhone },
  });
}
