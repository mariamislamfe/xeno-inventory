import { NextResponse } from "next/server";
import crypto from "crypto";

function md5hex(str: string)    { return crypto.createHash("md5").update(str, "utf8").digest("hex"); }
function md5base64(str: string) { return crypto.createHash("md5").update(str, "utf8").digest("base64"); }

const BASE_URL      = () => (process.env.JT_BASE_URL      ?? "").trim();
const UUID          = () => (process.env.JT_UUID          ?? "").trim();
const CUSTOMER_CODE = () => (process.env.JT_CUSTOMER_CODE ?? "").trim();
const PASSWORD      = () => (process.env.JT_PASSWORD      ?? "").trim();
const PRIVATE_KEY   = () => (process.env.JT_PRIVATE_KEY   ?? "").trim();
const API_ACCOUNT   = () => (process.env.JT_API_ACCOUNT   ?? "").trim();

function sign() {
  return md5base64(CUSTOMER_CODE() + md5hex(PASSWORD() + "jadada236t2").toUpperCase() + PRIVATE_KEY());
}

async function call(label: string, bizParams: Record<string, unknown>, extraHeaders: Record<string, string> = {}) {
  const bizContent = JSON.stringify(bizParams);
  const digest     = md5base64(bizContent + PRIVATE_KEY());
  const url        = `${BASE_URL()}/api/logistics/trace?uuid=${UUID()}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "timestamp":    String(Date.now()),
        "digest":       digest,
        ...extraHeaders,
      },
      body: new URLSearchParams({ bizContent }).toString(),
    });
    const d = await res.json();
    return { label, code: d?.code, msg: d?.msg ?? d?.message };
  } catch (e) { return { label, code: "ERR", msg: String(e) }; }
}

export async function GET() {
  if (!BASE_URL() || !UUID() || !CUSTOMER_CODE() || !API_ACCOUNT() || !PRIVATE_KEY()) {
    return NextResponse.json({ ok: false, error: "J&T env vars missing" }, { status: 503 });
  }

  const biz = { billCode: "TEST-XENO-000" };

  const results = await Promise.all([
    // A: apiAccount in header (current)
    call("A: apiAccount header", biz, { "apiAccount": API_ACCOUNT() }),

    // B: apiAccount inside bizContent
    call("B: apiAccount in bizContent", { apiAccount: API_ACCOUNT(), ...biz }),

    // C: customerCode + sign inside bizContent (like order format)
    call("C: customerCode+sign in bizContent", { customerCode: CUSTOMER_CODE(), sign: sign(), ...biz }),

    // D: all three inside bizContent, no extra header
    call("D: all inside bizContent", { apiAccount: API_ACCOUNT(), customerCode: CUSTOMER_CODE(), sign: sign(), ...biz }),
  ]);

  const winner = results.find(r => r.code !== "145003010" && r.code !== "145003051");

  return NextResponse.json({ winner: winner ?? "none", results });
}
