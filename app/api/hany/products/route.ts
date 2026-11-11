import { NextRequest, NextResponse } from "next/server";
import { hany, hanyConfigured } from "@/lib/hany/client";
import { hanyHandle } from "@/lib/hany/route";

export const revalidate = 0;

// GET /api/hany/products?q=&status=all|published|draft|archived&page=
export async function GET(req: NextRequest) {
  if (!hanyConfigured()) return NextResponse.json({ configured: false, products: [], pagination: null });
  const sp = req.nextUrl.searchParams;
  const qs = new URLSearchParams({
    status: ["published", "draft", "archived", "all"].includes(sp.get("status") ?? "") ? sp.get("status")! : "all",
    page:   String(Math.max(1, Number(sp.get("page")) || 1)),
    limit:  "24",
  });
  if (sp.get("q")) qs.set("q", sp.get("q")!);
  return hanyHandle(async () => {
    const r = await hany.products(qs);
    return { configured: true, products: r.data, pagination: r.pagination ?? null };
  });
}
