import crypto from "crypto";

// ── J&T Express Egypt API Client ─────────────────────────────────────────────
const BASE_URL      = (process.env.JT_BASE_URL      ?? "").trim();
const UUID          = (process.env.JT_UUID          ?? "").trim();
const CUSTOMER_CODE = (process.env.JT_CUSTOMER_CODE ?? "").trim();
const PASSWORD      = (process.env.JT_PASSWORD      ?? "").trim();
const PRIVATE_KEY   = (process.env.JT_PRIVATE_KEY   ?? "").trim();
const API_ACCOUNT   = (process.env.JT_API_ACCOUNT   ?? "").trim();

// ── Signature helpers ─────────────────────────────────────────────────────────

function md5hex(str: string): string {
  return crypto.createHash("md5").update(str, "utf8").digest("hex");
}

function md5base64(str: string): string {
  return crypto.createHash("md5").update(str, "utf8").digest("base64");
}

/** Header digest: base64(md5(bizContent + privateKey)) */
function headerDigest(bizContent: string): string {
  return md5base64(bizContent + PRIVATE_KEY);
}

/**
 * bizContent digest: base64(md5(customerCode + UPPER(md5(pwd+"jadada236t2")) + privateKey))
 * Field name inside bizContent is "digest" (per J&T Egypt API spec)
 */
function bizDigest(): string {
  const pwdHash = md5hex(PASSWORD + "jadada236t2").toUpperCase();
  return md5base64(CUSTOMER_CODE + pwdHash + PRIVATE_KEY);
}

// ── Generic J&T POST ──────────────────────────────────────────────────────────

async function jtPost(path: string, bizParams: Record<string, unknown>, timeoutMs = 15_000) {
  if (!API_ACCOUNT)   throw new Error("JT_API_ACCOUNT env var is missing");
  if (!CUSTOMER_CODE) throw new Error("JT_CUSTOMER_CODE env var is missing");
  if (!BASE_URL)      throw new Error("JT_BASE_URL env var is missing");

  const bizContent = JSON.stringify(bizParams);
  const url        = `${BASE_URL}${path}?uuid=${UUID}`;

  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method:  "POST",
      signal:  controller.signal,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "apiAccount":   API_ACCOUNT,
        "timestamp":    String(Date.now()),
        "digest":       headerDigest(bizContent),
      },
      body: new URLSearchParams({ bizContent }).toString(),
    });

    const data = await res.json();
    console.log(`[J&T] ${path}`, JSON.stringify(data).slice(0, 400));
    return data;
  } finally {
    clearTimeout(timer);
  }
}

// ── Create Order ──────────────────────────────────────────────────────────────

export interface JTOrderInput {
  orderNumber:  string;
  customerName: string;
  phone:        string;
  address:      string;
  city:         string;
  governorate:  string;
  items:        { name: string; qty: number }[];
  totalAmount:  number;
  weightKg?:    number;
}

export interface JTOrderResult {
  ok:              boolean;
  trackingNumber?: string;
  billCode?:       string;
  sortingCode?:    string;
  error?:          string;
  raw?:            unknown;
}

export async function createJTOrder(order: JTOrderInput): Promise<JTOrderResult> {
  // Shopify order names include "#" prefix (e.g. "#1001") — strip it for J&T
  const txlogisticId = (order.orderNumber ?? "").replace(/^#/, "").trim();
  if (!txlogisticId) {
    return { ok: false, error: `رقم الطلب فارغ أو غير صالح: "${order.orderNumber}"` };
  }

  const goodsName  = order.items.map(i => `${i.name} x${i.qty}`).join(", ").slice(0, 100) || "منتجات";
  const totalQty   = order.items.reduce((s, i) => s + i.qty, 0) || 1;
  const phone      = order.phone.replace(/[^0-9]/g, "").replace(/^20/, "0");

  const bizParams = {
    // ── Auth ──────────────────────────────────────────────────────────
    customerCode: CUSTOMER_CODE,
    digest:       bizDigest(),          // bizContent signature (field name per spec)

    // ── Order identity ────────────────────────────────────────────────
    txlogisticId,                       // customer order number (required)
    operateType:  1,                    // 1=add, 2=modify

    // ── Service type ─────────────────────────────────────────────────
    serviceType:  process.env.JT_SERVICE_TYPE ?? "02",  // 01 or 02 (required)
    orderType:    "2",
    expressType:  "EZ",                 // only "EZ" supported for Egypt standard
    deliveryType: "04",                 // 04=home delivery (required)

    // ── Payment ───────────────────────────────────────────────────────
    payType:      process.env.JT_PAY_TYPE ?? "PP_PM",   // PP_PM=monthly, PP_CASH=cash on post
    fodMoney:     String(order.totalAmount),             // COD collection amount

    // ── Parcel info ───────────────────────────────────────────────────
    goodsType:     process.env.JT_GOODS_TYPE ?? "ITN16", // ITN16=Others
    weight:        String(order.weightKg ?? 0.5),
    totalQuantity: 1,                                    // must be 1 per spec

    remark: `XENO #${txlogisticId}`.slice(0, 200),

    // ── Sender ────────────────────────────────────────────────────────
    sender: {
      name:        process.env.XENO_SENDER_NAME  ?? "XENO",
      mobile:      process.env.XENO_SENDER_PHONE ?? "",
      phone:       process.env.XENO_SENDER_PHONE ?? "",
      countryCode: "EGY",
      prov:        process.env.XENO_PROVINCE ?? "Cairo",
      city:        process.env.XENO_CITY     ?? "Cairo",
      area:        process.env.XENO_AREA     ?? process.env.XENO_CITY ?? "Cairo",
      address:     process.env.XENO_ADDRESS  ?? "",
      street:      process.env.XENO_ADDRESS  ?? "",
    },

    // ── Receiver ──────────────────────────────────────────────────────
    receiver: {
      name:        order.customerName,
      mobile:      phone,
      phone:       phone,
      countryCode: "EGY",
      prov:        order.governorate || order.city || "Cairo",
      city:        order.city        || "Cairo",
      area:        order.city        || "Cairo",
      address:     order.address     || order.city || "",
    },

    // ── Items ─────────────────────────────────────────────────────────
    items: [{
      itemName:    goodsName,
      englishName: goodsName,
      itemType:    process.env.JT_GOODS_TYPE ?? "ITN16",
      number:      totalQty,
      itemValue:   String(order.totalAmount),
      priceCurrency: "EGP",
    }],
  };

  try {
    const data = await jtPost("/api/order/addOrder", bizParams);
    const isSuccess = data?.code === "1" || data?.code === 1;
    if (isSuccess) {
      return {
        ok:           true,
        trackingNumber: data.data?.billCode,
        billCode:     data.data?.billCode,
        sortingCode:  data.data?.sortingCode,
        raw:          data,
      };
    }
    console.error("[J&T] addOrder failed:", JSON.stringify(data));
    return { ok: false, error: data?.msg ?? data?.message ?? JSON.stringify(data), raw: data };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// ── Get Tracking ──────────────────────────────────────────────────────────────

export async function getJTTracking(trackingNumber: string) {
  try {
    const data = await jtPost("/api/logistics/trace", {
      customerCode: CUSTOMER_CODE,
      digest:       bizDigest(),
      billCode:     trackingNumber,
    });
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// ── Cancel Order ──────────────────────────────────────────────────────────────

export async function cancelJTOrder(orderNumber: string) {
  const txlogisticId = (orderNumber ?? "").replace(/^#/, "").trim();
  try {
    const data = await jtPost("/api/order/cancelOrder", {
      customerCode: CUSTOMER_CODE,
      digest:       bizDigest(),
      txlogisticId,
    });
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
