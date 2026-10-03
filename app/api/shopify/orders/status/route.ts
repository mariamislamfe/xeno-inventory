import { NextRequest, NextResponse } from "next/server";

const SHOP    = process.env.SHOPIFY_SHOP!;
const TOKEN   = process.env.SHOPIFY_ACCESS_TOKEN!;
const VERSION = process.env.SHOPIFY_API_VERSION ?? "2026-07";

function h() {
  return { "X-Shopify-Access-Token": TOKEN, "Content-Type": "application/json" };
}

// Fulfill all line items on an order using the FulfillmentOrder API
async function fulfillOrder(shopifyId: number): Promise<{ ok: boolean; error?: string }> {
  // Step 1: get fulfillment orders
  const foResp = await fetch(
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
    const resp = await fetch(
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
  const resp = await fetch(
    `https://${SHOP}/admin/api/${VERSION}/orders/${shopifyId}/cancel.json`,
    { method: "POST", headers: h(), body: JSON.stringify({}) }
  );
  if (!resp.ok) {
    const txt = await resp.text();
    return { ok: false, error: txt };
  }
  return { ok: true };
}

// POST /api/shopify/orders/status
// Body: { shopifyId: number, action: "fulfill" | "cancel" }
export async function POST(req: NextRequest) {
  try {
    const { shopifyId, action } = await req.json();
    if (!shopifyId || !action) {
      return NextResponse.json({ error: "shopifyId and action required" }, { status: 400 });
    }

    let result: { ok: boolean; error?: string };
    if (action === "fulfill") {
      result = await fulfillOrder(Number(shopifyId));
    } else if (action === "cancel") {
      result = await cancelOrder(Number(shopifyId));
    } else {
      return NextResponse.json({ error: "invalid action" }, { status: 400 });
    }

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 422 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
