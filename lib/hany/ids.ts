// HANY orders in the tables that key on a numeric shopify_order_id (shipments,
// whatsapp_messages, activity_log, xeno_ops…).
//
// HANY order numbers look like "HNY-100001". Each one gets the number
// 9_000_000_000_000_000 + 100001 = 9000000000100001: far above any Shopify order id
// (~7e12 today) and below Number.MAX_SAFE_INTEGER (~9.007e15), so it is exact in JS
// and fits a Postgres BIGINT. Safe to import anywhere.

export const HANY_ID_BASE = 9_000_000_000_000_000;
const MAX_ORDER_NO = Number.MAX_SAFE_INTEGER - HANY_ID_BASE;   // ~7.2e12

export function hanyId(orderNumber: string): number {
  const digits = String(orderNumber).replace(/\D/g, "");
  const n = Number(digits);
  if (!digits || !Number.isSafeInteger(n) || n <= 0 || n > MAX_ORDER_NO) {
    throw new Error(`رقم طلب HANY غير متوقع: ${orderNumber}`);
  }
  return HANY_ID_BASE + n;
}

export function isHanyId(id: unknown): boolean {
  const n = Number(id);
  return Number.isSafeInteger(n) && n > HANY_ID_BASE;
}

/** Back from the number to "HNY-100001" (HANY numbers have no leading zeros). */
export function hanyOrderNumber(id: number | string): string {
  return `HNY-${Number(id) - HANY_ID_BASE}`;
}
