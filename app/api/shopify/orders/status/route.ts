import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/client";
import { requireAdmin } from "@/lib/auth/requireAdmin";

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

// Mark an order confirmed: add the "confirmed" tag (drops conflicting status tags) and record the op
async function confirmOrder(shopifyId: number): Promise<{ ok: boolean; error?: string }> {
  const orderUrl = `https://${SHOP}/admin/api/${VERSION}/orders/${shopifyId}.json`;
  const getResp = await sfetch(orderUrl, { headers: h(), cache: "no-store" });
  if (!getResp.ok) return { ok: false, error: `order fetch failed: ${getResp.status}` };

  const { order } = await getResp.json() as {
    order: { name: string; tags: string; total_price: string; phone?: string | null; customer?: { first_name?: string; last_name?: string; phone?: string | null } | null };
  };
  const drop = new Set(["cancelled", "postponed", "ملغي"]);
  const tags = order.tags.split(",").map((t) => t.trim()).filter((t) => t && !drop.has(t.toLowerCase()));
  if (!tags.includes("confirmed")) tags.push("confirmed");

  const putResp = await sfetch(orderUrl, {
    method:  "PUT",
    headers: h(),
    body:    JSON.stringify({ order: { id: shopifyId, tags: tags.join(",") } }),
  });
  if (!putResp.ok) return { ok: false, error: await putResp.text() };

  // Best-effort: the ops table may not exist yet
  await supabaseAdmin.from("xeno_ops").upsert({
    shopify_order_id: shopifyId,
    order_number:     order.name,
    customer_name:    [order.customer?.first_name, order.customer?.last_name].filter(Boolean).join(" ") || null,
    phone:            order.phone ?? order.customer?.phone ?? null,
    total:            Number(order.total_price),
    op_status:        "confirmed",
    updated_at:       new Date().toISOString(),
  }, { onConflict: "shopify_order_id" });

  return { ok: true };
}

// Back to "جديد": drop the confirmed tag
async function unconfirmOrder(shopifyId: number): Promise<{ ok: boolean; error?: string }> {
  const orderUrl = `https://${SHOP}/admin/api/${VERSION}/orders/${shopifyId}.json`;
  const getResp = await sfetch(orderUrl, { headers: h(), cache: "no-store" });
  if (!getResp.ok) return { ok: false, error: `order fetch failed: ${getResp.status}` };
  const { order } = await getResp.json() as { order: { tags: string } };
  const tags = order.tags.split(",").map((t) => t.trim()).filter((t) => t && t.toLowerCase() !== "confirmed");

  const putResp = await sfetch(orderUrl, {
    method:  "PUT",
    headers: h(),
    body:    JSON.stringify({ order: { id: shopifyId, tags: tags.join(",") } }),
  });
  if (!putResp.ok) return { ok: false, error: await putResp.text() };

  await supabaseAdmin.from("xeno_ops")
    .update({ op_status: "pending", updated_at: new Date().toISOString() })
    .eq("shopify_order_id", shopifyId);
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

    let result: { ok: boolean; error?: string };
    if (action === "fulfill") {
      result = await fulfillOrder(Number(shopifyId));
    } else if (action === "cancel") {
      result = await cancelOrder(Number(shopifyId));
    } else if (action === "confirm") {
      result = await confirmOrder(Number(shopifyId));
    } else if (action === "unconfirm") {
      result = await unconfirmOrder(Number(shopifyId));
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
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
