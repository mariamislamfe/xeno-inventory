import { NextRequest, NextResponse } from "next/server";
import { syncShipmentStatuses } from "@/lib/shipments";

export const maxDuration = 60;

// POST /api/shipments/sync[?force=1] — update shipment statuses from J&T tracking.
// Without force, a shipment checked in the last 10 minutes is skipped.
export async function POST(req: NextRequest) {
  const force = req.nextUrl.searchParams.get("force") === "1";
  // Optional body { tracking_numbers: [...] } — check exactly these (print page)
  const body = await req.json().catch(() => null) as { tracking_numbers?: unknown } | null;
  const trackingNumbers = Array.isArray(body?.tracking_numbers)
    ? body.tracking_numbers.filter((t): t is string => typeof t === "string")
    : undefined;
  const result = await syncShipmentStatuses({ minAgeMs: force ? 0 : 10 * 60 * 1000, trackingNumbers });
  if ("error" in result && result.error) return NextResponse.json(result, { status: 500 });
  return NextResponse.json({ ok: true, ...result });
}
