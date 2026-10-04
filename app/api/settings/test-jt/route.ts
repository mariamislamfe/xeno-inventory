import { NextResponse } from "next/server";
import crypto from "crypto";

function md5hex(str: string)    { return crypto.createHash("md5").update(str, "utf8").digest("hex"); }
function md5base64(str: string) { return crypto.createHash("md5").update(str, "utf8").digest("base64"); }

function headerDigest(bizContent: string, privateKey: string) {
  return md5base64(bizContent + privateKey);
}

function bizDigest(customerCode: string, password: string, privateKey: string) {
  const pwdHash = md5hex(password + "jadada236t2").toUpperCase();
  return md5base64(customerCode + pwdHash + privateKey);
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
      billCode: "TEST-XENO-000",
    });
    // 145003100 = "Illegal waybill" → header auth OK; code=1 = actual success
    const ok = data?.code === "1" || data?.code === 1 || data?.code === "145003100" || String(data?.code).startsWith("1450");
    traceResult = { data, jtCode: data?.code, jtMsg: data?.msg, ok };
  } catch (err) {
    traceResult = { data: null, jtCode: null, jtMsg: null, ok: false, error: String(err) };
  }

  // ── Test 2: addOrder (tests customerCode + bizDigest) ─────────────────────────
  // Use a clearly-fake duplicate txlogisticId so J&T rejects on "duplicate" (not "customer not found")
  // If J&T returns "customer not found" here, the customerCode is wrong/inactive
  const senderName  = (process.env.XENO_SENDER_NAME  ?? "TEST").slice(0, 30);
  const senderPhone = (process.env.XENO_SENDER_PHONE ?? "01000000000").replace(/[^0-9]/g,"").replace(/^20/,"0");
  const senderProv  = process.env.XENO_PROVINCE ?? "Cairo";
  const senderCity  = process.env.XENO_CITY     ?? "Cairo";
  const senderAddr  = process.env.XENO_ADDRESS  ?? "Test Address";

  let addOrderResult: { data: unknown; jtCode: unknown; jtMsg: unknown; ok: boolean; customerCodeOk: boolean; error?: string } = {
    data: null, jtCode: null, jtMsg: null, ok: false, customerCodeOk: false,
  };
  try {
    const { data } = await jtPost(BASE_URL, UUID, API_ACCOUNT, PRIVATE_KEY, "/api/order/addOrder", {
      customerCode: CUSTOMER_CODE,
      digest:       bizDigest(CUSTOMER_CODE, PASSWORD, PRIVATE_KEY),
      txlogisticId: `XENO-TEST-${Date.now()}`,
      operateType:  1,
      serviceType:  process.env.JT_SERVICE_TYPE ?? "02",
      orderType:    "2",
      expressType:  "EZ",
      deliveryType: "04",
      payType:      process.env.JT_PAY_TYPE ?? "PP_PM",
      fodMoney:     "100",
      goodsType:    process.env.JT_GOODS_TYPE ?? "ITN16",
      weight:       "0.5",
      totalQuantity: "1",
      remark:       "XENO API TEST",
      sender: {
        name: senderName, mobile: senderPhone, phone: senderPhone,
        countryCode: "EGY", prov: senderProv, city: senderCity,
        area: senderCity, address: senderAddr, street: senderAddr,
      },
      receiver: {
        name: "TEST RECEIVER", mobile: "01000000001", phone: "01000000001",
        countryCode: "EGY", prov: "Cairo", city: "Cairo",
        area: "Cairo", address: "Test Street", street: "Test Street",
      },
      items: [{
        itemName: "Test Item", englishName: "Test Item",
        itemType: process.env.JT_GOODS_TYPE ?? "ITN16",
        number: 1, itemValue: "100", priceCurrency: "EGP",
      }],
    });

    // "customer not found" → customerCode wrong / not activated
    // "duplicate" / "already exists" → customerCode recognized ✓ (order already exists)
    // code=1 → unlikely for a test order but would mean success
    const customerNotFound = String(data?.msg ?? "").toLowerCase().includes("customer") ||
                             String(data?.msg ?? "").toLowerCase().includes("not found") ||
                             data?.code === "400" || data?.code === 400;
    const customerCodeOk   = !customerNotFound && (data?.code !== undefined);

    addOrderResult = { data, jtCode: data?.code, jtMsg: data?.msg, ok: data?.code === "1" || data?.code === 1, customerCodeOk };
  } catch (err) {
    addOrderResult = { data: null, jtCode: null, jtMsg: null, ok: false, customerCodeOk: false, error: String(err) };
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
      jtCode:  addOrderResult.jtCode,
      jtMsg:   addOrderResult.jtMsg,
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
