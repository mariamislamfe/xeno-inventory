import { NextResponse } from "next/server";

// ── WhatsApp service connection test ─────────────────────────────────────────
export async function GET() {
  const WA_URL    = process.env.WA_SERVICE_URL;
  const WA_SECRET = process.env.WA_SECRET;

  if (!WA_URL) {
    return NextResponse.json({
      ok: false,
      error: "WA_SERVICE_URL غير مضبوط. خدمة واتساب الداخلية معطّلة حالياً.",
    }, { status: 503 });
  }

  try {
    const res  = await fetch(`${WA_URL}/`, {
      headers: { "x-wa-secret": WA_SECRET ?? "" },
    });
    const data = await res.json();

    if (data.ready) {
      return NextResponse.json({ ok: true, message: "واتساب متصل ومستعد ✅", detail: data });
    }
    if (data.hasQR) {
      return NextResponse.json({ ok: false, error: "الخدمة شغّالة لكن تحتاج سكان QR — افتح /wa/qr", detail: data });
    }
    return NextResponse.json({ ok: true, message: "الخدمة شغّالة (جارٍ الاتصال...)", detail: data });
  } catch (err) {
    return NextResponse.json({ ok: false, error: `تعذّر الوصول لخدمة واتساب: ${String(err)}` }, { status: 500 });
  }
}
