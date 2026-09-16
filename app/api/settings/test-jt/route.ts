import { NextResponse } from "next/server";
import crypto from "crypto";

function md5base64(str: string): string {
  return crypto.createHash("md5").update(str, "utf8").digest("base64");
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

  const bizParams  = { billCode: "TEST-XENO-000" };
  const bizContent = JSON.stringify(bizParams);
  const digest     = md5base64(bizContent + PRIVATE_KEY);
  const url        = `${BASE_URL}/api/logistics/trace?uuid=${UUID}`;

  const sentPayload = {
    customerCode: `${CUSTOMER_CODE.slice(0,3)}...`,
    apiAccount:   `${API_ACCOUNT.slice(0,5)}...`,
    privateKey:   `${PRIVATE_KEY.slice(0,5)}...`,
    uuid:         `${UUID.slice(0,5)}...`,
    headers:      { apiAccount: `${API_ACCOUNT.slice(0,5)}...`, timestamp: "...", digest: `${digest.slice(0,8)}...` },
    body:         `bizContent=${bizContent.slice(0,30)}...`,
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

    return NextResponse.json({
      ok:          data?.code === "1" || data?.code === 1,
      jtCode:      data?.code,
      jtMsg:       data?.msg ?? data?.message,
      raw:         data,
      sentPayload,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err), sentPayload }, { status: 500 });
  }
}
