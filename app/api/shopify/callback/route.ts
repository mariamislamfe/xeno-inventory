import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/client";

// Public route — called by Shopify OAuth redirect, no auth cookie available
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const shop = req.nextUrl.searchParams.get("shop");

  if (!code || !shop) {
    return NextResponse.json({ error: "Missing code or shop param" }, { status: 400 });
  }

  const clientId     = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "SHOPIFY_CLIENT_ID or SHOPIFY_CLIENT_SECRET not set in Vercel env vars" },
      { status: 503 },
    );
  }

  // Exchange OAuth code for access token
  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: `Token exchange failed: ${text}` }, { status: 500 });
  }

  const data = await res.json() as { access_token: string; scope: string };

  // Save to xeno_settings so we can retrieve it later
  await supabaseAdmin
    .from("xeno_settings")
    .upsert(
      { key: "shopify_access_token", value: data.access_token, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    )
    .maybeSingle();

  // Show the token once so the admin can copy it to Vercel
  return NextResponse.json({
    ok:           true,
    access_token: data.access_token,
    scope:        data.scope,
    note:         "انسخ access_token وحطه في Vercel → SHOPIFY_ACCESS_TOKEN ثم Redeploy",
  });
}
