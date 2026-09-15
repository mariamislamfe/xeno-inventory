import { NextResponse } from "next/server";
import crypto from "crypto";

// ── J&T connection test ───────────────────────────────────────────────────────
// Tries to call the J&T API with a minimal payload to verify credentials work.

function md5hex(str: string) {
  return crypto.createHash("md5").update(str, "utf8").digest("hex");
}
function base64Md5(str: string) {
  return Buffer.from(md5hex(str)).toString("base64");
}

export async function GET() {
  const BASE_URL      = process.env.JT_BASE_URL;
  const UUID          = process.env.JT_UUID;
  const CUSTOMER_CODE = process.env.JT_CUSTOMER_CODE;
  const PASSWORD      = process.env.JT_PASSWORD;
  const PRIVATE_KEY   = process.env.JT_PRIVATE_KEY;
  const API_ACCOUNT   = process.env.JT_API_ACCOUNT;

  if (!BASE_URL || !UUID || !CUSTOMER_CODE || !PASSWORD || !PRIVATE_KEY || !API_ACCOUNT) {
    return NextResponse.json({
      ok: false,
      error: "متغيرات البيئة الخاصة بـ J&T غير مكتملة. تأكد من: JT_BASE_URL, JT_UUID, JT_CUSTOMER_CODE, JT_PASSWORD, JT_PRIVATE_KEY, JT_API_ACCOUNT",
    }, { status: 503 });
  }

  // Build digest
  const pwdProcessed = md5hex(PASSWORD + "jadada236t2");
  const bodyDigest   = base64Md5(CUSTOMER_CODE + pwdProcessed + PRIVATE_KEY);

  // Use a simple query — e.g. query a non-existent tracking number just to get API response
  const bizParams  = { billCode: "TEST-XENO-000" };
  const bizContent = JSON.stringify(bizParams);
  const headerDig  = base64Md5(bizContent + PRIVATE_KEY);

  const url = `${BASE_URL}/api/logistics/trace?uuid=${UUID}`;

  try {
    const res = await fetch(url, {
      method:  "POST",
      headers: {
        "Content-Type": "application/json",
        "digest":        headerDig,
      },
      body: JSON.stringify({
        customerCode: CUSTOMER_CODE,
        apiAccount:   API_ACCOUNT,
        digest:       bodyDigest,
        bizContent,
      }),
    });

    const data = await res.json();

    // J&T returns code "1" for success, other codes for errors
    // Even a "not found" response means the API is reachable and credentials are accepted
    const sentPayload = {
      customerCode: CUSTOMER_CODE ? `${CUSTOMER_CODE.slice(0,3)}...` : "EMPTY",
      apiAccount:   API_ACCOUNT   ? `${API_ACCOUNT.slice(0,5)}...` : "EMPTY",
      privateKey:   PRIVATE_KEY   ? `${PRIVATE_KEY.slice(0,5)}...` : "EMPTY",
      uuid:         UUID          ? `${UUID.slice(0,5)}...`        : "EMPTY",
    };

    if (res.ok) {
      return NextResponse.json({
        ok:          data?.code === "1" || data?.code === 1,
        jtCode:      data?.code,
        jtMsg:       data?.msg ?? data?.message,
        raw:         data,
        sentPayload,
      });
    }

    return NextResponse.json({ ok: false, error: `HTTP ${res.status}`, raw: data, sentPayload }, { status: res.status });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
