// Server-only: talks to the HANY store REST API with HANY_API_KEY.
// Never import this from a client component (the key would end up in the browser).
import crypto from "crypto";
import type { HanyOrder, HanyProduct, HanyPagination } from "./types";

const BASE = (process.env.HANY_API_URL ?? "https://hany-store-three.vercel.app/api/v1").replace(/\/+$/, "");

export function hanyConfigured(): boolean {
  return Boolean(process.env.HANY_API_KEY);
}

export class HanyError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

interface HanyResponse<T> { data: T; pagination?: HanyPagination }

export async function hanyFetch<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<HanyResponse<T>> {
  const key = process.env.HANY_API_KEY;
  if (!key) throw new HanyError(503, "not_configured", "HANY مش متوصل (HANY_API_KEY مش متسجل)");

  let resp: Response;
  try {
    resp = await fetch(`${BASE}${path}`, {
      method:  init.method ?? "GET",
      headers: {
        Authorization:  `Bearer ${key}`,
        ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body:    init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache:   "no-store",
      signal:  AbortSignal.timeout(15_000),
    });
  } catch (err) {
    throw new HanyError(502, "unreachable", `موقع HANY مش بيرد: ${String(err)}`);
  }

  const json = await resp.json().catch(() => null) as (HanyResponse<T> & { error?: { code: string; message: string } }) | null;
  if (!resp.ok || !json) {
    throw new HanyError(resp.status, json?.error?.code ?? "error", json?.error?.message ?? `HANY رد بـ ${resp.status}`);
  }
  return json;
}

const enc = encodeURIComponent;

export const hany = {
  /** All orders created in [since, until), newest first, up to `max`. */
  async ordersInRange(since?: string, until?: string, max = 500): Promise<{ orders: HanyOrder[]; truncated: boolean }> {
    const out: HanyOrder[] = [];
    for (let page = 1; out.length < max; page++) {
      const qs = new URLSearchParams({ page: String(page), limit: "100" });
      if (since) qs.set("created_since", since);
      const r = await hanyFetch<HanyOrder[]>(`/orders?${qs}`);
      out.push(...r.data);
      if (!r.pagination || page >= r.pagination.pages || r.data.length === 0) {
        return { orders: filterUntil(out, until), truncated: false };
      }
    }
    return { orders: filterUntil(out.slice(0, max), until), truncated: true };
  },
  order:         (id: string) => hanyFetch<HanyOrder>(`/orders/${enc(id)}`),
  updateOrder:   (id: string, body: { internal_notes: string }) => hanyFetch<HanyOrder>(`/orders/${enc(id)}`, { method: "PATCH", body }),
  setStatus:     (id: string, body: { status: string; note?: string }) => hanyFetch<HanyOrder>(`/orders/${enc(id)}/status`, { method: "POST", body }),
  setPayment:    (id: string, body: { status: string; reference?: string }) => hanyFetch<HanyOrder>(`/orders/${enc(id)}/payment`, { method: "POST", body }),
  products:      (qs: URLSearchParams) => hanyFetch<HanyProduct[]>(`/products?${qs}`),
  updateProduct: (id: string, body: Record<string, unknown>) => hanyFetch<HanyProduct>(`/products/${enc(id)}`, { method: "PATCH", body }),
  setStock:      (variantId: string, body: { set: number } | { adjust: number; reason?: string }) =>
    hanyFetch<unknown>(`/variants/${enc(variantId)}/stock`, { method: "PATCH", body }),
};

function filterUntil(orders: HanyOrder[], until?: string) {
  if (!until) return orders;
  const max = new Date(until).getTime();
  return orders.filter((o) => new Date(o.created_at).getTime() <= max);
}

/** Hany-Signature: t=<unix>,v1=<hex HMAC-SHA256(secret, "t.rawBody")>, within ±5 minutes. */
export function verifyHanySignature(rawBody: string, header: string, secret: string): boolean {
  const parts = Object.fromEntries(header.split(",").map((p) => {
    const i = p.indexOf("=");
    return [p.slice(0, i).trim(), p.slice(i + 1).trim()];
  }));
  const t = Number(parts.t);
  if (!Number.isFinite(t) || Math.abs(Date.now() / 1000 - t) > 300) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${parts.t}.${rawBody}`).digest("hex");
  const got = String(parts.v1 ?? "");
  if (got.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(got));
}
