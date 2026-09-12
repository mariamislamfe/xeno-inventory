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
    if (res.ok) {
      // If code is not an auth error, consider it connected
      const code = String(data?.code ?? "");
      if (code === "401" || code === "403" || data?.message?.includes("auth") || data?.message?.includes("sign")) {
        return NextResponse.json({ ok: false, error: `خطأ في بيانات الاعتماد: ${data?.message ?? code}`, raw: data });
      }
      return NextResponse.json({
        ok: true,
        message: `J&T API يعمل — استجابة: ${data?.message ?? data?.code ?? "OK"}`,
        raw: data,
      });
    }

    return NextResponse.json({ ok: false, error: `HTTP ${res.status}`, raw: data }, { status: res.status });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
