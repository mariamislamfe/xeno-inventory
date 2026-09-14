import { NextResponse } from "next/server";
import { shopifyFetch } from "@/lib/shopify/client";

export async function GET() {
  try {
    const data = await shopifyFetch<{ access_scopes: { handle: string }[] }>(
      "/access_scopes.json",
    );
    const scopes = data.access_scopes.map((s) => s.handle);
    return NextResponse.json({
      hasOrderEdit: scopes.includes("write_order_edits"),
      scopes,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
