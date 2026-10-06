// Client helper: print an order's J&T waybill. Going through J&T's print API is what
// moves the order to "Printed" on their side, so every print button should use this.
// Must be called directly from a click handler (it opens the tab before awaiting).
export async function printOrderLabel(shopifyOrderId: number): Promise<void> {
  const win = window.open("", "_blank");
  try {
    const res  = await fetch("/api/print/label", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ shopify_order_id: shopifyOrderId }),
    });
    const data = await res.json().catch(() => ({}));

    // Not a J&T shipment (e.g. tracking from another carrier) → our own label page
    if (res.status === 404) {
      const href = `/dashboard/orders/${shopifyOrderId}/label`;
      if (win) win.location.href = href; else window.open(href, "_blank");
      return;
    }
    if (!res.ok || !data.ok) throw new Error(data.error ?? "فشل جلب البوليصة من J&T");

    const href = data.pdfBase64 ? base64PdfUrl(data.pdfBase64) : data.url;
    if (win) win.location.href = href; else window.open(href, "_blank");
  } catch (err) {
    win?.close();
    throw err;
  }
}

function base64PdfUrl(b64: string) {
  const bin   = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
}
