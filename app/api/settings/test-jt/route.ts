import { NextResponse } from "next/server";
import crypto from "crypto";

function md5base64(str: string): string {
  return crypto.createHash("md5").update(str, "utf8").digest("base64");
}

export async function GET() {
  // Trim all values to catch hidden whitespace
  const BASE_URL      = (process.env.JT_BASE_URL      ?? "").trim();
  const UUID          = (process.env.JT_UUID          ?? "").trim();
  const CUSTOMER_CODE = (process.env.JT_CUSTOMER_CODE ?? "").trim();
  const PASSWORD      = (process.env.JT_PASSWORD      ?? "").trim();
  const PRIVATE_KEY   = (process.env.JT_PRIVATE_KEY   ?? "").trim();
  const API_ACCOUNT   = (process.env.JT_API_ACCOUNT   ?? "").trim();

  if (!BASE_URL || !UUID || !CUSTOMER_CODE || !PASSWORD || !PRIVATE_KEY || !API_ACCOUNT) {
    return NextResponse.json({ ok: false, error: "J&T env vars missing" }, { status: 503 });
  }

  const bizContent = JSON.stringify({ billCode: "TEST-XENO-000" });
  const digest     = md5base64(bizContent + PRIVATE_KEY);
  const url        = `${BASE_URL}/api/logistics/trace?uuid=${UUID}`;

  // Debug: show lengths to catch invisible chars
  const debug = {
    BASE_URL_len:     BASE_URL.length,
    UUID_len:         UUID.length,        // should be 32
    API_ACCOUNT_len:  API_ACCOUNT.length, // should be 18
    PRIVATE_KEY_len:  PRIVATE_KEY.length, // should be 32
    fullUrl:          url,
    digest_preview:   digest.slice(0, 12) + "...",
  };

  try {
    const res = await fetch(url, {
      method:  "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "apiAccount":   API_ACCOUNT,
        "timestamp":    String(Date.now()),
        "digest":       digest,
      },
      body: new URLSearchParams({ bizContent }).toString(),
    });

    const data = await res.json();
    return NextResponse.json({ jtCode: data?.code, jtMsg: data?.msg, raw: data, debug });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err), debug }, { status: 500 });
  }
}
