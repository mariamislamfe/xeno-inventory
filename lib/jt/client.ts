import crypto from "crypto";

// ── Config ────────────────────────────────────────────────────────────────────
const BASE_URL       = process.env.JT_BASE_URL      ?? "";
const UUID           = process.env.JT_UUID          ?? "";
const CUSTOMER_CODE  = process.env.JT_CUSTOMER_CODE ?? "";
const PASSWORD       = process.env.JT_PASSWORD      ?? "";
const PRIVATE_KEY    = process.env.JT_PRIVATE_KEY   ?? "";
const API_ACCOUNT    = process.env.JT_API_ACCOUNT   ?? "";

// ── Signature ─────────────────────────────────────────────────────────────────

function md5hex(str: string) {
  return crypto.createHash("md5").update(str, "utf8").digest("hex");
}

function base64Md5(str: string) {
  return Buffer.from(md5hex(str)).toString("base64");
}

/** digest inside the request body */
function bodyDigest() {
  const pwdProcessed = md5hex(PASSWORD + "jadada236t2");
  return base64Md5(CUSTOMER_CODE + pwdProcessed + PRIVATE_KEY);
}

/** digest header — computed from the bizContent JSON string */
function headerDigest(bizContent: string) {
  return base64Md5(bizContent + PRIVATE_KEY);
}

// ── Generic J&T request ───────────────────────────────────────────────────────

async function jtPost(path: string, bizParams: Record<string, unknown>) {
  const bizContent = JSON.stringify(bizParams);

  const payload = {
    customerCode: CUSTOMER_CODE,
    apiAccount:   API_ACCOUNT,
    digest:       bodyDigest(),
    bizContent,
  };

  const url = `${BASE_URL}${path}?uuid=${UUID}`;

  const res = await fetch(url, {
    method:  "POST",
    headers: {
      "Content-Type": "application/json",
      "digest":        headerDigest(bizContent),
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  console.log(`[J&T] ${path}`, JSON.stringify(data).slice(0, 300));
  return data;
}

// ── Create Order ──────────────────────────────────────────────────────────────

export interface JTOrderInput {
  orderNumber:    string;
  customerName:   string;
  phone:          string;
  address:        string;
  city:           string;
  governorate:    string;
  items:          { name: string; qty: number }[];
  totalAmount:    number;
  weightKg?:      number;
}

export interface JTOrderResult {
  ok:              boolean;
  trackingNumber?: string;
  jtOrderId?:      string;
  error?:          string;
  raw?:            unknown;
}

export async function createJTOrder(order: JTOrderInput): Promise<JTOrderResult> {
  const goodsName = order.items.map(i => `${i.name} x${i.qty}`).join(", ").slice(0, 100);

  const bizParams = {
    orderCode:            order.orderNumber,
    senderName:           process.env.XENO_SENDER_NAME    ?? "XENO",
    senderMobile:         process.env.XENO_SENDER_PHONE   ?? "",
    senderProvinceName:   process.env.XENO_PROVINCE       ?? "Cairo",
    senderCityName:       process.env.XENO_CITY           ?? "Cairo",
    senderAddress:        process.env.XENO_ADDRESS        ?? "",
    receiverName:         order.customerName,
    receiverMobile:       order.phone.replace(/[^0-9]/g, "").replace(/^20/, "0"),
    receiverProvinceName: order.governorate || order.city || "Cairo",
    receiverCityName:     order.city || "Cairo",
    receiverAddress:      order.address || order.city,
    goodsName,
    goodsWeight:          order.weightKg ?? 0.5,
    goodsNum:             order.items.reduce((s, i) => s + i.qty, 0) || 1,
    payType:              1,        // 1 = COD
    codAmount:            order.totalAmount,
    remark:               `XENO Order #${order.orderNumber}`,
  };

  try {
    const data = await jtPost("/api/order/addOrder", bizParams);

    // J&T success: code "1" or "200", tracking in data.billCode or data.waybillNo
    const isSuccess = data?.code === "1" || data?.code === 1 || data?.success === true;
    if (isSuccess) {
      const tracking = data?.data?.billCode ?? data?.data?.waybillNo ?? data?.data?.trackingNumber;
      return { ok: true, trackingNumber: tracking, jtOrderId: data?.data?.orderId, raw: data };
    }
    return { ok: false, error: data?.message ?? data?.msg ?? JSON.stringify(data), raw: data };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// ── Get Tracking ──────────────────────────────────────────────────────────────

export async function getJTTracking(trackingNumber: string) {
  try {
    const data = await jtPost("/api/logistics/trace", { billCode: trackingNumber });
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// ── Cancel Order ──────────────────────────────────────────────────────────────

export async function cancelJTOrder(orderNumber: string) {
  try {
    const data = await jtPost("/api/order/cancelOrder", { orderCode: orderNumber });
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
