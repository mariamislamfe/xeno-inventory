import { NextResponse } from "next/server";
import crypto from "crypto";

function md5base64(str: string): string {
  return crypto.createHash("md5").update(str, "utf8").digest("base64");
}

async function tryRequest(url: string, apiAccountValue: string, bizContent: string, privateKey: string) {
  const digest = md5base64(bizContent + privateKey);
  try {
    const res = await fetch(url, {
      method:  "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "apiAccount":   apiAccountValue,
        "timestamp":    String(Date.now()),
        "digest":       digest,
      },
      body: new URLSearchParams({ bizContent }).toString(),
    });
    const data = await res.json();
    return { code: data?.code, msg: data?.msg ?? data?.message, raw: data };
  } catch (err) {
    return { code: "ERR", msg: String(err) };
  }
}

export async function GET() {
  const BASE_URL      = process.env.JT_BASE_URL;
  const UUID          = process.env.JT_UUID;
  const CUSTOMER_CODE = process.env.JT_CUSTOMER_CODE;
  const PASSWORD      = process.env.JT_PASSWORD;
  const PRIVATE_KEY   = process.env.JT_PRIVATE_KEY;
  const API_ACCOUNT   = process.env.JT_API_ACCOUNT;

  if (!BASE_URL || !UUID || !CUSTOMER_CODE || !PASSWORD || !PRIVATE_KEY || !API_ACCOUNT) {
    return NextResponse.json({ ok: false, error: "J&T env vars missing" }, { status: 503 });
  }

  const bizContent = JSON.stringify({ billCode: "TEST-XENO-000" });
  const url        = `${BASE_URL}/api/logistics/trace?uuid=${UUID}`;

  // Try A: numeric apiAccount (current approach)
  const trialA = await tryRequest(url, API_ACCOUNT, bizContent, PRIVATE_KEY);

  // Try B: UUID as apiAccount
  const trialB = await tryRequest(url, UUID, bizContent, PRIVATE_KEY);

  const winner = trialA.code !== "145003010" && trialA.code !== "145003051"
    ? "A (numeric apiAccount)"
    : trialB.code !== "145003010" && trialB.code !== "145003051"
      ? "B (UUID as apiAccount)"
      : "neither";

  return NextResponse.json({
    winner,
    trialA: { apiAccountUsed: `${API_ACCOUNT.slice(0,8)}...`, ...trialA },
    trialB: { apiAccountUsed: `${UUID.slice(0,8)}...`, ...trialB },
  });
}
