// Server-only: how many orders each customer has (like "3 orders" in Shopify admin).
// One GraphQL call for a whole page of customers.
const SHOP    = process.env.SHOPIFY_SHOP;
const TOKEN   = process.env.SHOPIFY_ACCESS_TOKEN;
const VERSION = process.env.SHOPIFY_API_VERSION ?? "2026-07";

export async function customerOrderCounts(customerIds: number[]): Promise<Map<number, number>> {
  const out = new Map<number, number>();
  const ids = [...new Set(customerIds.filter((id) => Number.isSafeInteger(id) && id > 0))];
  if (!ids.length || !SHOP || !TOKEN) return out;
  for (let i = 0; i < ids.length; i += 100) {
    try {
      const res = await fetch(`https://${SHOP}/admin/api/${VERSION}/graphql.json`, {
        method:  "POST",
        headers: { "X-Shopify-Access-Token": TOKEN, "Content-Type": "application/json" },
        cache:   "no-store",
        body:    JSON.stringify({
          query: `query($ids: [ID!]!) { nodes(ids: $ids) { ... on Customer { id numberOfOrders } } }`,
          variables: { ids: ids.slice(i, i + 100).map((id) => `gid://shopify/Customer/${id}`) },
        }),
      });
      if (!res.ok) continue;
      const data = await res.json() as { data?: { nodes: ({ id: string; numberOfOrders: string | number } | null)[] } };
      for (const n of data.data?.nodes ?? []) {
        if (n?.id) out.set(Number(n.id.split("/").pop()), Number(n.numberOfOrders));
      }
    } catch { /* counts are optional */ }
  }
  return out;
}

/** Attach customerOrdersCount + lastAction to a page of orders. */
export async function withCustomerCountsAndActions<T extends { shopifyId: number; customerId?: number }>(orders: T[]) {
  const { lastActions } = await import("@/lib/audit");
  const [counts, actions] = await Promise.all([
    customerOrderCounts(orders.map((o) => o.customerId ?? 0)),
    lastActions(orders.map((o) => o.shopifyId)),
  ]);
  return orders.map((o) => ({
    ...o,
    customerOrdersCount: o.customerId ? counts.get(o.customerId) : undefined,
    lastAction:          actions.get(String(o.shopifyId)),
  }));
}
