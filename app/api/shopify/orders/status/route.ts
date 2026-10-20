import { NextRequest, NextResponse } from "next/server";
import { logOrderAction } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { setReviewStatus } from "@/lib/order-status-server";

const SHOP    = process.env.SHOPIFY_SHOP!;
const TOKEN   = process.env.SHOPIFY_ACCESS_TOKEN!;
const VERSION = process.env.SHOPIFY_API_VERSION ?? "2026-07";

function h() {
  return { "X-Shopify-Access-Token": TOKEN, "Content-Type": "application/json" };
}

// fetch with retry on Shopify's REST rate limit (bulk actions send bursts)
async function sfetch(url: string, init?: RequestInit, attempts = 4): Promise<Response> {
  for (let i = 1; ; i++) {
    const resp = await fetch(url, init);
    if (resp.status !== 429 || i >= attempts) return resp;
    const wait = Number(resp.headers.get("Retry-After")) || 1;
    await new Promise((r) => setTimeout(r, wait * 1000));
  }
}

// Fulfill all line items on an order using the FulfillmentOrder API
async function fulfillOrder(shopifyId: number): Promise<{ ok: boolean; error?: string }> {
  // Step 1: get fulfillment orders
  const foResp = await sfetch(
    `https://${SHOP}/admin/api/${VERSION}/orders/${shopifyId}/fulfillment_orders.json`,
    { headers: h() }
  );
  if (!foResp.ok) return { ok: false, error: `fulfillment_orders fetch failed: ${foResp.status}` };

  const foData = await foResp.json() as { fulfillment_orders: { id: number; status: string }[] };
  const pending = (foData.fulfillment_orders ?? []).filter(
    (fo) => fo.status === "open" || fo.status === "in_progress"
  );
  if (!pending.length) return { ok: true }; // already fulfilled

  // Step 2: fulfill each pending fulfillment order
  for (const fo of pending) {
    const resp = await sfetch(
      `https://${SHOP}/admin/api/${VERSION}/fulfillments.json`,
      {
        method:  "POST",
        headers: h(),
        body: JSON.stringify({
          fulfillment: {
            line_items_by_fulfillment_order: [{ fulfillment_order_id: fo.id }],
            notify_customer: false,
          },
        }),
      }
    );
    if (!resp.ok) {
      const txt = await resp.text();
      return { ok: false, error: txt };
    }
  }
  return { ok: true };
}

// Cancel an order
async function cancelOrder(shopifyId: number): Promise<{ ok: boolean; error?: string }> {
  const resp = await sfetch(
    `https://${SHOP}/admin/api/${VERSION}/orders/${shopifyId}/cancel.json`,
    { method: "POST", headers: h(), body: JSON.stringify({}) }
  );
  if (!resp.ok) {
    const txt = await resp.text();
    return { ok: false, error: txt };
  }
  return { ok: true };
}

// Delete an order. Shopify only deletes cancelled orders, so cancel first.
async function deleteOrder(shopifyId: number): Promise<{ ok: boolean; error?: string }> {
  await cancelOrder(shopifyId); // fails harmlessly if it's already cancelled
  const resp = await sfetch(
    `https://${SHOP}/admin/api/${VERSION}/orders/${shopifyId}.json`,
    { method: "DELETE", headers: h() }
  );
  if (!resp.ok) return { ok: false, error: await resp.text() };
  return { ok: true };
}

// POST /api/shopify/orders/status
// Body: { shopifyId: number, action: "fulfill" | "cancel" | "confirm" | "delete" }
export async function POST(req: NextRequest) {
  try {
    const { shopifyId, action } = await req.json();
    if (!shopifyId || !action) {
      return NextResponse.json({ error: "shopifyId and action required" }, { status: 400 });
    }

    let result: { ok: boolean; error?: string; orderNumber?: string };
    if (action === "fulfill") {
      result = await fulfillOrder(Number(shopifyId));
    } else if (action === "cancel") {
      result = await setReviewStatus(Number(shopifyId), "cancelled");
    } else if (action === "confirm") {
      result = await setReviewStatus(Number(shopifyId), "confirmed");
    } else if (action === "unconfirm") {
      result = await setReviewStatus(Number(shopifyId), "new");
    } else if (action === "wait") {
      result = await setReviewStatus(Number(shopifyId), "waiting");
    } else if (action === "postpone") {
      result = await setReviewStatus(Number(shopifyId), "postponed");
    } else if (action === "delete") {
      // Deleting orders is a manager-only action
      const auth = await requireAdmin();
      if (!auth.ok) return auth.response;
      result = await deleteOrder(Number(shopifyId));
    } else {
      return NextResponse.json({ error: "invalid action" }, { status: 400 });
    }

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 422 });
    }
    const STATUS_AR: Record<string, string> = {
      unconfirm: "جديد", wait: "انتظار", postpone: "مؤجل", confirm: "مكتمل", cancel: "ملغي",
    };
    const num = "orderNumber" in result && result.orderNumber ? `${result.orderNumber} ` : "";
    if (STATUS_AR[action]) {
      await logOrderAction(shopifyId, "status", `غيّر حالة ${num}لـ «${STATUS_AR[action]}»`, { status: action });
    } else if (action === "delete") {
      await logOrderAction(shopifyId, "delete", "مسح الطلب نهائياً");
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
