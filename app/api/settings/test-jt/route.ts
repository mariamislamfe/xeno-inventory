import { NextResponse } from "next/server";
import crypto from "crypto";

function md5hex(str: string)    { return crypto.createHash("md5").update(str, "utf8").digest("hex"); }
function md5base64(str: string) { return crypto.createHash("md5").update(str, "utf8").digest("base64"); }

export async function GET() {
  const BASE_URL      = (process.env.JT_BASE_URL      ?? "").trim();
  const UUID          = (process.env.JT_UUID          ?? "").trim();
  const CUSTOMER_CODE = (process.env.JT_CUSTOMER_CODE ?? "").trim();
  const PASSWORD      = (process.env.JT_PASSWORD      ?? "").trim();
  const PRIVATE_KEY   = (process.env.JT_PRIVATE_KEY   ?? "").trim();
  const API_ACCOUNT   = (process.env.JT_API_ACCOUNT   ?? "").trim();

  if (!BASE_URL || !UUID || !CUSTOMER_CODE || !PASSWORD || !PRIVATE_KEY || !API_ACCOUNT) {
    return NextResponse.json({ ok: false, error: "J&T env vars missing" }, { status: 503 });
  }

  const bizContent  = JSON.stringify({ billCode: "TEST-XENO-000" });
  const digest      = md5base64(bizContent + PRIVATE_KEY);
  const timestamp   = String(Date.now());
  const url         = `${BASE_URL}/api/logistics/trace?uuid=${UUID}`;
  const formBody    = new URLSearchParams({ bizContent }).toString();

  // Sign calculation for reference
  const pwdMd5      = md5hex(PASSWORD + "jadada236t2").toUpperCase();
  const sign        = md5base64(CUSTOMER_CODE + pwdMd5 + PRIVATE_KEY);

  const fullPayload = {
    url,
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "apiAccount":   API_ACCOUNT,
      "timestamp":    timestamp,
      "digest":       digest,
    },
    body: formBody,
    bizContentParsed: { billCode: "TEST-XENO-000" },
    digestCalculation: {
      formula:  "base64(md5(bizContent + privateKey))",
      result:   digest,
    },
    signCalculation: {
      formula:  "base64(md5(customerCode + UPPER(md5(password+'jadada236t2')) + privateKey))",
      result:   sign,
    },
  };

  try {
    const res  = await fetch(url, { method: "POST", headers: fullPayload.headers, body: formBody });
    const data = await res.json();

    return NextResponse.json({
      jtResponse:  data,
      fullPayload,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err), fullPayload }, { status: 500 });
  }
}
