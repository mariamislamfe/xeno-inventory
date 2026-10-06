import { NextResponse } from "next/server";
import crypto from "crypto";
import { buildAddOrderBiz, cancelJTOrder, jtPost as clientJtPost } from "@/lib/jt/client";

function md5base64(str: string) { return crypto.createHash("md5").update(str, "utf8").digest("base64"); }

function headerDigest(bizContent: string, privateKey: string) {
  return md5base64(bizContent + privateKey);
}


async function jtPost(
  baseUrl: string, uuid: string, apiAccount: string, privateKey: string,
  path: string, bizParams: Record<string, unknown>,
) {
  const bizContent = JSON.stringify(bizParams);
  const url        = `${baseUrl}${path}${uuid ? `?uuid=${uuid}` : ""}`;
  const headers    = {
    "Content-Type": "application/x-www-form-urlencoded",
    "apiAccount":   apiAccount,
    "timestamp":    String(Date.now()),
    "digest":       headerDigest(bizContent, privateKey),
  };
  const body = new URLSearchParams({ bizContent }).toString();
  const res  = await fetch(url, { method: "POST", headers, body });
  return { data: await res.json(), url, headers: { ...headers, digest: "***" }, bizParams };
}

export async function GET() {
  const BASE_URL      = (process.env.JT_BASE_URL      ?? "").trim();
  const UUID          = (process.env.JT_UUID          ?? "").trim();
  const CUSTOMER_CODE = (process.env.JT_CUSTOMER_CODE ?? "").trim();
  const PASSWORD      = (process.env.JT_PASSWORD      ?? "").trim();
  const PRIVATE_KEY   = (process.env.JT_PRIVATE_KEY   ?? "").trim();
  const API_ACCOUNT   = (process.env.JT_API_ACCOUNT   ?? "").trim();

  const missing = ["JT_BASE_URL","JT_UUID","JT_CUSTOMER_CODE","JT_PASSWORD","JT_PRIVATE_KEY","JT_API_ACCOUNT"]
    .filter((k) => !process.env[k]?.trim());
  if (missing.length) {
    return NextResponse.json({ ok: false, error: `Missing env vars: ${missing.join(", ")}` }, { status: 503 });
  }

  // ── Test 1: trace (header auth only — no customerCode in body) ────────────────
  let traceResult: { data: unknown; jtCode: unknown; jtMsg: unknown; ok: boolean; error?: string } = { data: null, jtCode: null, jtMsg: null, ok: false };
  try {
    const { data } = await jtPost(BASE_URL, UUID, API_ACCOUNT, PRIVATE_KEY, "/api/logistics/trace", {
      billCodes: "TEST-XENO-000",
    });
    // 145003100 = "Illegal waybill" → header auth OK; code=1 = actual success
    const ok = data?.code === "1" || data?.code === 1 || data?.code === "145003100" || String(data?.code).startsWith("1450");
    traceResult = { data, jtCode: data?.code, jtMsg: data?.msg, ok };
  } catch (err) {
    traceResult = { data: null, jtCode: null, jtMsg: null, ok: false, error: String(err) };
  }

  // ── Test 2: addOrder (tests customerCode + bizDigest + payload) ───────────────
  // Uses the exact payload real shipments use. This hits the live account, so a test
  // order that succeeds is cancelled immediately.
  let addOrderResult: { data: unknown; jtCode: unknown; jtMsg: unknown; ok: boolean; customerCodeOk: boolean; cancelled?: boolean; error?: string } = {
    data: null, jtCode: null, jtMsg: null, ok: false, customerCodeOk: false,
  };
  const testOrderNumber = `XENO-TEST-${Date.now()}`;
  const built = buildAddOrderBiz({
    orderNumber:  testOrderNumber,
    customerName: "TEST RECEIVER",
    phone:        "01000000001",
    address:      "مدينة نصر، شارع عباس العقاد",
    city:         "مدينة نصر",
    governorate:  "القاهرة",
    items:        [{ name: "Test Item", qty: 1 }],
    totalAmount:  100,
  });
  if (!built.ok) {
    addOrderResult = { ...addOrderResult, error: built.error };
  } else {
    try {
      const data = await clientJtPost("/api/order/addOrder", built.biz);
      // "customer not found" → customerCode wrong / not activated
      const customerNotFound = String(data?.msg ?? "").toLowerCase().includes("customer") ||
                               String(data?.msg ?? "").toLowerCase().includes("not found") ||
                               data?.code === "400" || data?.code === 400 || String(data?.code) === "145003031";
      const customerCodeOk   = !customerNotFound && (data?.code !== undefined);
      const ok = data?.code === "1" || data?.code === 1;
      let cancelled: boolean | undefined;
      if (ok) {
        const c = await cancelJTOrder(String(built.biz.txlogisticId));
        cancelled = c.ok && (c.data?.code === "1" || c.data?.code === 1);
      }
      addOrderResult = { data, jtCode: data?.code, jtMsg: data?.msg, ok, customerCodeOk, cancelled };
    } catch (err) {
      addOrderResult = { ...addOrderResult, error: String(err) };
    }
  }

  const overallOk = traceResult.ok && addOrderResult.customerCodeOk;

  return NextResponse.json({
    ok:     overallOk,
    status: overallOk
      ? "متصل ✓ — الاعتماديات صحيحة"
      : !traceResult.ok
        ? "❌ Header auth فاشل — تحقق من JT_API_ACCOUNT و JT_PRIVATE_KEY"
        : !addOrderResult.customerCodeOk
          ? "❌ customerCode غير معروف — تحقق من JT_CUSTOMER_CODE و JT_PASSWORD (أو حساب J&T مش activated)"
          : "خطأ غير معروف",
    traceTest: {
      description: "Header auth (apiAccount + privateKey) — لا يتحقق من customerCode",
      ok:      traceResult.ok,
      jtCode:  traceResult.jtCode,
      jtMsg:   traceResult.jtMsg,
    },
    addOrderTest: {
      description: "addOrder auth — يتحقق من customerCode + digest (bizDigest)",
      customerCodeOk: addOrderResult.customerCodeOk,
      orderCreated:   addOrderResult.ok,
      testOrderCancelled: addOrderResult.cancelled,
      jtCode:  addOrderResult.jtCode,
      jtMsg:   addOrderResult.jtMsg,
      error:   addOrderResult.error,
    },
    envCheck: {
      JT_BASE_URL:      BASE_URL   ? "✓ موجود" : "❌ مفقود",
      JT_UUID:          UUID       ? "✓ موجود" : "❌ مفقود",
      JT_CUSTOMER_CODE: CUSTOMER_CODE ? `✓ (${CUSTOMER_CODE.slice(0, 3)}***)` : "❌ مفقود",
      JT_PASSWORD:      PASSWORD   ? "✓ موجود" : "❌ مفقود",
      JT_PRIVATE_KEY:   PRIVATE_KEY? "✓ موجود" : "❌ مفقود",
      JT_API_ACCOUNT:   API_ACCOUNT? "✓ موجود" : "❌ مفقود",
    },
  });
}
