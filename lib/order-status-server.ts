// Server-only: change an order's dashboard status (see lib/order-status).
import { supabaseAdmin } from "@/lib/supabase/client";
import { withStatus, type ReviewStatus } from "@/lib/order-status";

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

// Set the dashboard status (جديد / انتظار / مكتمل / ملغي) — our own tags only, so
// Shopify's own tags are left alone — and record it in xeno_ops.
// (Shopify's own cancel can't be undone, so it's only used right before deleting.)
export async function setReviewStatus(shopifyId: number, status: ReviewStatus): Promise<{ ok: boolean; error?: string; orderNumber?: string }> {
  const orderUrl = `https://${SHOP}/admin/api/${VERSION}/orders/${shopifyId}.json`;
  const getResp = await sfetch(orderUrl, { headers: h(), cache: "no-store" });
  if (!getResp.ok) return { ok: false, error: `order fetch failed: ${getResp.status}` };
  const { order } = await getResp.json() as {
    order: { name: string; tags: string; total_price: string; current_total_price?: string; phone?: string | null; customer?: { first_name?: string; last_name?: string; phone?: string | null } | null };
  };
  const tags = withStatus(order.tags.split(","), status);

  const putResp = await sfetch(orderUrl, {
    method:  "PUT",
    headers: h(),
    body:    JSON.stringify({ order: { id: shopifyId, tags: tags.join(",") } }),
  });
  if (!putResp.ok) return { ok: false, error: await putResp.text() };

  await supabaseAdmin.from("xeno_ops").upsert({
    shopify_order_id: shopifyId,
    order_number:     order.name,
    customer_name:    [order.customer?.first_name, order.customer?.last_name].filter(Boolean).join(" ") || null,
    phone:            order.phone ?? order.customer?.phone ?? null,
    total:            Number(order.current_total_price ?? order.total_price),
    op_status:        status === "new" ? "pending" : status,
    updated_at:       new Date().toISOString(),
  }, { onConflict: "shopify_order_id" });
  return { ok: true, orderNumber: order.name };
}
