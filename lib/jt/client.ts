import crypto from "crypto";
import { toLocal } from "@/lib/phone";
import { resolveJTAddress } from "@/lib/jt/address";

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

export async function jtPost(path: string, bizParams: Record<string, unknown>, timeoutMs = 15_000) {
  if (!API_ACCOUNT)   throw new Error("JT_API_ACCOUNT env var is missing");
  if (!CUSTOMER_CODE) throw new Error("JT_CUSTOMER_CODE env var is missing");
  if (!BASE_URL)      throw new Error("JT_BASE_URL env var is missing");

  const bizContent = JSON.stringify(bizParams);
  const url        = UUID ? `${BASE_URL}${path}?uuid=${UUID}` : `${BASE_URL}${path}`;

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

// Common addOrder error codes (J&T API docs) → Arabic explanation
const JT_ERRORS: Record<string, string> = {
  "145003030": "توقيع الـ headers غلط — راجع JT_API_ACCOUNT و JT_PRIVATE_KEY",
  "145003031": "توقيع الـ bizContent غلط — راجع JT_CUSTOMER_CODE و JT_PASSWORD",
  "145003060": "المنطقة مش موجودة عند J&T",
  "145003061": "المدينة مش موجودة عند J&T",
  "145003062": "المحافظة مش موجودة عند J&T",
  "145003083": "بيانات الراسل ناقصة",
  "145003084": "بيانات المستلم ناقصة",
  "145003085": "رقم الموبايل فاضي",
  "145003092": "الوزن غير صالح",
  "145003101": "رقم الطلب ده اتبعت لـ J&T قبل كده",
  "145002001": "الطلب ده اتبعت لـ J&T قبل كده",
  "145003111": "عدد الطرود غير صالح (لازم 1)",
  "145003112": "خدمة التحصيل (COD) مش مفعلة على الحساب",
  "145003113": "طريقة الدفع (payType) مش متوافقة مع الحساب",
  "145003040": "خطأ داخلي عند J&T — جرّب تاني بعد شوية",
  "145005000": "خطأ في سيستم J&T — جرّب تاني بعد شوية",
  "145003050": "بيانات مرفوضة من J&T (Illegal parameters)",
  "145003100": "رقم البوليصة غير صحيح عند J&T",
};

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

/**
 * Build the addOrder bizContent per the J&T Egypt spec.
 * Notes from J&T support: FOD (fodMoney) is NOT enabled on our account — the amount to
 * collect goes in itemsValue — and totalQuantity must be the number 1.
 */
export function buildAddOrderBiz(order: JTOrderInput): { ok: true; biz: Record<string, unknown>; areaGuessed: boolean } | { ok: false; error: string } {
  // Shopify order names include "#" prefix (e.g. "#1001") — strip it for J&T
  const txlogisticId = (order.orderNumber ?? "").replace(/^#/, "").trim();
  if (!txlogisticId) {
    return { ok: false, error: `رقم الطلب فارغ أو غير صالح: "${order.orderNumber}"` };
  }

  // Phones: 11-digit local format (spec: String(11))
  const receiverPhone = toLocal(order.phone);
  if (receiverPhone.length !== 11) {
    return { ok: false, error: `رقم موبايل العميل غير صالح: "${order.phone}" — لازم 11 رقم` };
  }
  const senderPhone = toLocal(process.env.XENO_SENDER_PHONE);
  if (senderPhone.length !== 11) {
    return { ok: false, error: "XENO_SENDER_PHONE غير مضبوط أو مش 11 رقم" };
  }

  // prov/city/area must match J&T's address table exactly
  const receiverAddr = resolveJTAddress({ governorate: order.governorate, city: order.city, address: order.address });
  if (!receiverAddr.ok) return { ok: false, error: receiverAddr.error };

  const senderStreet = process.env.XENO_ADDRESS ?? "";
  const senderAddr = resolveJTAddress({
    governorate: process.env.XENO_PROVINCE ?? "",
    city:        process.env.XENO_CITY     ?? "",
    address:     [process.env.XENO_AREA ?? "", senderStreet].join("، "),
  });
  if (!senderAddr.ok) return { ok: false, error: `عنوان الراسل (XENO_PROVINCE / XENO_CITY / XENO_AREA): ${senderAddr.error}` };

  const goodsType = process.env.JT_GOODS_TYPE ?? "ITN16"; // ITN16 = Others
  const amount    = String(Math.max(0, Math.round(order.totalAmount * 100) / 100));
  const itemsText = order.items.map((i) => `${i.name} *${i.qty}`).join("; ") || "منتجات";
  const street    = (order.address || receiverAddr.area).slice(0, 200);

  const biz = {
    // ── Auth ──
    customerCode: CUSTOMER_CODE,
    digest:       bizDigest(),

    // ── Order identity / service ──
    txlogisticId,
    operateType:  1,                                     // 1 = add
    serviceType:  process.env.JT_SERVICE_TYPE ?? "02",   // 01 or 02 (validated by J&T, error 145003200)
    expressType:  "EZ",                                  // only "EZ" supported
    deliveryType: "04",                                  // home delivery
    payType:      process.env.JT_PAY_TYPE ?? "PP_PM",    // PP_PM = monthly settlement

    // ── Parcel ──
    goodsType,
    weight:        String(order.weightKg ?? 0.5),        // kg, 0.01–30
    totalQuantity: 1,                                    // must be 1 (int)
    itemsValue:    amount,                               // amount to collect from the customer
    priceCurrency: "EGP",
    remark:        `XENO #${txlogisticId}`,
    pickInfo:      itemsText.slice(0, 500),

    sender: {
      name:        (process.env.XENO_SENDER_NAME ?? "XENO").slice(0, 50),
      mobile:      senderPhone,
      phone:       senderPhone,
      countryCode: "EGY",
      prov:        senderAddr.prov,
      city:        senderAddr.city,
      area:        senderAddr.area,
      street:      (senderStreet || senderAddr.area).slice(0, 200),
      address:     (senderStreet || senderAddr.area).slice(0, 200),
    },

    receiver: {
      name:        (order.customerName || "عميل").slice(0, 50),
      mobile:      receiverPhone,
      phone:       receiverPhone,
      countryCode: "EGY",
      prov:        receiverAddr.prov,
      city:        receiverAddr.city,
      area:        receiverAddr.area,
      street,
      address:     street,
    },

    items: [{
      itemType:      goodsType,
      itemName:      itemsText.slice(0, 30),
      englishName:   itemsText.slice(0, 60),
      number:        1,                                  // spec: ≤ 1
      itemValue:     amount,
      priceCurrency: "EGP",
      desc:          itemsText.slice(0, 100),
    }],
  };

  return { ok: true, biz, areaGuessed: receiverAddr.areaGuessed };
}

export async function createJTOrder(order: JTOrderInput): Promise<JTOrderResult> {
  const built = buildAddOrderBiz(order);
  if (!built.ok) return { ok: false, error: built.error };
  const bizParams = built.biz;

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
    const code = String(data?.code ?? "");
    const msg  = data?.msg ?? data?.message ?? JSON.stringify(data);
    return { ok: false, error: JT_ERRORS[code] ? `${JT_ERRORS[code]} (${code}: ${msg})` : `${msg} (${code})`, raw: data };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// ── Get Tracking ──────────────────────────────────────────────────────────────

export async function getJTTracking(trackingNumber: string) {
  try {
    // Header auth only; up to 30 comma-separated waybills
    const data = await jtPost("/api/logistics/trace", { billCodes: trackingNumber });
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

// ── Print Waybill ─────────────────────────────────────────────────────────────
// Printing through the API is what moves the order to "Printed" on the J&T side.
// Returns the waybill PDF as base64 (base64EncodeContent).
export async function printJTOrder(billCode: string): Promise<
  { ok: true; pdfBase64?: string; url?: string } | { ok: false; error: string }
> {
  try {
    const data = await jtPost("/api/order/printOrder", {
      customerCode:        CUSTOMER_CODE,
      digest:              bizDigest(),
      billCode,
      printSize:           0, // one-sided sheet (thermal label)
      printCod:            1, // show the COD amount for the courier
      showCustomerOrderId: 1, // barcode of our order number
    }, 30_000);
    const ok = data?.code === "1" || data?.code === 1;
    const pdfBase64 = data?.data?.base64EncodeContent as string | undefined;
    const url       = data?.data?.urlContent as string | undefined;
    if (ok && (pdfBase64 || url)) return { ok: true, pdfBase64, url };
    const code = String(data?.code ?? "");
    const msg  = data?.msg ?? data?.message ?? "لم يرجع ملف البوليصة";
    return { ok: false, error: JT_ERRORS[code] ? `${JT_ERRORS[code]} (${code}: ${msg})` : `${msg} (${code})` };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
