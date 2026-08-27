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

  // Always log — even on handler failure
  await supabaseAdmin.from("webhook_log").insert({
    topic,
    shop,
    payload,
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
