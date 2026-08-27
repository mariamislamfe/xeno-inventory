import { NextRequest, NextResponse } from "next/server";
import { shopifyFetch, shopifyPost } from "@/lib/shopify/client";

const APP_URL = "https://xeno-inventory.vercel.app";

const TOPICS = [
  "orders/create",
  "orders/updated",
  "orders/cancelled",
  "orders/paid",
];

interface ShopifyWebhook {
  id: number;
  topic: string;
  address: string;
  format: string;
}

// GET — list existing webhooks
export async function GET(req: NextRequest) {
  const token = req.headers.get("x-register-token");
  if (token !== process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const data = await shopifyFetch<{ webhooks: ShopifyWebhook[] }>("/webhooks.json");
  return NextResponse.json({ webhooks: data.webhooks });
}

// POST — register all topics (safe to call multiple times)
export async function POST(req: NextRequest) {
  const token = req.headers.get("x-register-token");
  if (token !== process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get existing to avoid duplicates
  const existing = await shopifyFetch<{ webhooks: ShopifyWebhook[] }>("/webhooks.json");
  const existingTopics = new Set(existing.webhooks.map((w) => w.topic));

  const results: { topic: string; status: string; id?: number; error?: string }[] = [];

  for (const topic of TOPICS) {
    if (existingTopics.has(topic)) {
      results.push({ topic, status: "already_exists" });
      continue;
    }
    try {
      const data = await shopifyPost<{ webhook: ShopifyWebhook }>("/webhooks.json", {
        webhook: {
          topic,
          address: `${APP_URL}/api/webhooks/shopify`,
          format:  "json",
        },
      });
      results.push({ topic, status: "created", id: data.webhook.id });
    } catch (err) {
      results.push({ topic, status: "error", error: String(err) });
    }
  }

  return NextResponse.json({ results });
}
