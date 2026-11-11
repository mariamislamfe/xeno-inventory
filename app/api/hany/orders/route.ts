import { NextRequest, NextResponse } from "next/server";
import { hany, hanyConfigured } from "@/lib/hany/client";
import { hanyHandle } from "@/lib/hany/route";
import { hanyToXeno } from "@/lib/hany/labels";
import { withShipmentTracking } from "@/lib/shipments";
import { lastActions } from "@/lib/audit";

export const revalidate = 0;

// GET /api/hany/orders?since=ISO&until=ISO
// Every HANY order created in that range (newest first), shaped like the orders list,
// with its J&T tracking number and the team's last action, like Shopify orders.
// Not configured → an empty list, so the orders page keeps working with Shopify only.
export async function GET(req: NextRequest) {
  if (!hanyConfigured()) return NextResponse.json({ configured: false, orders: [], truncated: false });
  const sp = req.nextUrl.searchParams;
  return hanyHandle(async () => {
    const { orders, truncated } = await hany.ordersInRange(sp.get("since") || undefined, sp.get("until") || undefined);
    const rows = orders.map(hanyToXeno);
    const [tracked, actions] = await Promise.all([withShipmentTracking(rows), lastActions(rows.map((o) => o.shopifyId))]);
    return {
      configured: true,
      truncated,
      orders: tracked.map((o) => ({ ...o, lastAction: actions.get(String(o.shopifyId)) })),
    };
  });
}
