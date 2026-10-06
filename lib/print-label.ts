// Client helper: print an order's J&T waybill. Going through J&T's print API is what
// moves the order to "Printed" on their side, so every print button should use this.
// Must be called directly from a click handler (it opens the tab before awaiting).

export interface LabelItem { qty: number; name: string; color: string; size: string; sku: string }

// preview: show the label on screen without printing or recording a print
export async function printOrderLabel(shopifyOrderId: number, opts: { preview?: boolean } = {}): Promise<void> {
  const win = window.open("", "_blank");
  try {
    const res  = await fetch("/api/print/label", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ shopify_order_id: shopifyOrderId, preview: opts.preview ?? false }),
    });
    const data = await res.json().catch(() => ({}));

    // Not a J&T shipment (e.g. tracking from another carrier) → our own label page
    if (res.status === 404) {
      const href = `/dashboard/orders/${shopifyOrderId}/label`;
      if (win) win.location.href = href; else window.open(href, "_blank");
      return;
    }
    if (!res.ok || !data.ok) throw new Error(data.error ?? "فشل جلب البوليصة من J&T");

    if (data.pdfBase64 && win) {
      writeLabelPage(win, data.pdfBase64, data.items ?? [], !opts.preview);
      return;
    }
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

// Renders J&T's PDF with pdf.js and draws our items table over the REMARKS box
// (between the "REMARKS" title and the footer row). If the box can't be found or
// the table doesn't fit, the table goes on a second label instead.
// If pdf.js fails to load, J&T's PDF is shown as-is.
function writeLabelPage(win: Window, pdfBase64: string, items: LabelItem[], autoPrint: boolean) {
  win.document.open();
  win.document.write(labelPageHtml(pdfBase64, items, base64PdfUrl(pdfBase64), autoPrint));
  win.document.close();
}

export function labelPageHtml(pdfBase64: string, items: LabelItem[], fallbackUrl: string, autoPrint = true): string {
  const payload = JSON.stringify({ pdf: pdfBase64, items }).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="ar"><head><meta charset="utf-8"><title>بوليصة الشحن</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #fff; font-family: Arial, "Segoe UI", Tahoma, sans-serif; }
  #status { padding: 24px; font-size: 14px; text-align: center; color: #555; }
  .page { position: relative; overflow: hidden; page-break-after: always; break-after: page; }
  .page:last-child { page-break-after: auto; break-after: auto; }
  .page img { display: block; width: 100%; height: 100%; }
  .box { position: absolute; overflow: hidden; direction: rtl; }
  .cover { position: absolute; background: #fff; }
  table { width: 100%; border-collapse: collapse; color: #000; background: #fff; }
  th, td { border: 0.6pt solid #000; padding: 0.6pt 1.5pt; text-align: center; line-height: 1.15; word-break: break-word; }
  th { font-weight: 700; background: #eee; }
  td.qty, td.sku { font-weight: 700; white-space: nowrap; }
  .more { font-size: 7pt; font-weight: 700; text-align: center; padding-top: 2pt; }
  @media screen {
    body { background: #e5e7eb; padding: 16px 0; }
    .page { margin: 0 auto 16px; background: #fff; box-shadow: 0 2px 10px rgba(0,0,0,.15); }
  }
  @media print { #status { display: none; } }
</style></head>
<body><div id="status">جارٍ تجهيز البوليصة...</div>
<script id="data" type="application/json">${payload}</script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"
  onerror='location.replace(${JSON.stringify(fallbackUrl)})'></script>
<script>
(async function () {
  var fallback = ${JSON.stringify(fallbackUrl)};
  try {
    var data = JSON.parse(document.getElementById("data").textContent);
    var lib = window.pdfjsLib;
    lib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    var bin = atob(data.pdf), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    var pdf = await lib.getDocument({ data: bytes }).promise;
    var page = await pdf.getPage(1);
    var vp1 = page.getViewport({ scale: 1 });
    var W = vp1.width, H = vp1.height, SCALE = 4;

    var style = document.createElement("style");
    style.textContent = "@page { size: " + W + "pt " + H + "pt; margin: 0; } .page { width: " + W + "pt; height: " + H + "pt; }";
    document.head.appendChild(style);

    var canvas = document.createElement("canvas");
    var vp = page.getViewport({ scale: SCALE });
    canvas.width = vp.width; canvas.height = vp.height;
    await page.render({ canvasContext: canvas.getContext("2d"), viewport: vp }).promise;

    // Locate the REMARKS box from the text layer (PDF coords: y grows upward)
    var text = await page.getTextContent();
    var remarks = null, footer = null;
    text.items.forEach(function (t) {
      var s = (t.str || "").trim();
      if (!remarks && /^REMARKS?$/i.test(s)) remarks = t;
      if (/^\\d{4}-\\d{2}-\\d{2}/.test(s)) footer = t;
    });
    // Lowest line of J&T's remark text (between the title and the footer)
    var remarkBottom = null;
    if (remarks && footer) text.items.forEach(function (t) {
      var y = t.transform[5];
      if ((t.str || "").trim() && t !== remarks && y < remarks.transform[5] && y > footer.transform[5] + footer.height) {
        remarkBottom = remarkBottom === null ? y : Math.min(remarkBottom, y);
      }
    });

    var sheet = document.createElement("div");
    sheet.className = "page";
    var img = new Image();
    img.src = canvas.toDataURL("image/png");
    sheet.appendChild(img);
    document.body.appendChild(sheet);

    // Relabel J&T's English fields: "Cods" → "المبلغ", amount → "900 جنيه", and the
    // always-empty "FOD" (not enabled on our account) → "COD"
    function coverItem(t) {
      var c = document.createElement("div");
      c.className = "cover";
      c.style.left = (t.transform[4] - 0.5) + "pt";
      // glyph box: ~0.85×height above the baseline, ~0.2×height below it
      c.style.top = (H - t.transform[5] - t.height * 0.9) + "pt";
      c.style.width = (t.width + 1) + "pt";
      c.style.height = (t.height * 1.12) + "pt";
      sheet.appendChild(c);
    }
    function writeAt(t, str, bold) {
      var d = document.createElement("div");
      d.style.position = "absolute";
      d.style.left = t.transform[4] + "pt";
      d.style.top = (H - t.transform[5] - t.height * 0.85) + "pt";
      d.style.fontSize = (t.height * 0.95) + "pt";
      d.style.lineHeight = "1";
      d.style.whiteSpace = "nowrap";
      d.style.color = "#000";
      if (bold) d.style.fontWeight = "700";
      d.textContent = str;
      sheet.appendChild(d);
    }
    var cods = null, fod = null;
    text.items.forEach(function (t) {
      var s = (t.str || "").trim();
      if (!cods && /^cods?$/i.test(s)) cods = t;
      if (!fod && /^fod$/i.test(s)) fod = t;
    });
    if (cods) {
      var amount = null;
      text.items.forEach(function (t) {
        if (!amount && t !== cods && /^\\d+(\\.\\d+)?$/.test((t.str || "").trim()) &&
            Math.abs(t.transform[5] - cods.transform[5]) < 3 && t.transform[4] > cods.transform[4]) amount = t;
      });
      coverItem(cods);
      writeAt(cods, "المبلغ", false);
      if (amount) {
        coverItem(amount);
        var n = parseFloat(amount.str);
        writeAt(amount, (n % 1 ? n.toFixed(2) : String(n)) + " جنيه", true);
      }
    }
    if (fod) { coverItem(fod); writeAt(fod, "COD", false); }

    function buildTable(fontPt) {
      var table = document.createElement("table");
      table.style.fontSize = fontPt + "pt";
      var head = table.insertRow();
      ["العدد", "المنتج", "اللون", "المقاس", "الكود"].forEach(function (h) {
        var th = document.createElement("th"); th.textContent = h; head.appendChild(th);
      });
      data.items.forEach(function (it) {
        var tr = table.insertRow();
        [[it.qty, "qty"], [it.name, ""], [it.color || "-", ""], [it.size || "-", ""], [it.sku || "-", "sku"]].forEach(function (c) {
          var td = tr.insertCell(); td.textContent = String(c[0]); if (c[1]) td.className = c[1];
        });
      });
      return table;
    }

    var placed = false;
    if (data.items.length && remarks && footer) {
      var top = H - remarks.transform[5] + 1.5;                 // just under the "REMARKS" title
      var bottom = H - (footer.transform[5] + footer.height) - 9; // above the footer row line
      if (bottom - top > 18) {
        // Blank out J&T's one-line remark text, leaving the box borders alone
        if (remarkBottom !== null) {
          var cover = document.createElement("div");
          cover.className = "cover";
          cover.style.left = "2pt"; cover.style.width = (W - 4) + "pt";
          cover.style.top = top + "pt"; cover.style.height = (H - remarkBottom + 2.5 - top) + "pt";
          sheet.appendChild(cover);
        }
        var box = document.createElement("div");
        box.className = "box";
        box.style.left = "2pt"; box.style.width = (W - 4) + "pt";
        box.style.top = top + "pt"; box.style.height = (bottom - top) + "pt";
        sheet.appendChild(box);
        for (var f = 8; f >= 5; f -= 0.5) {
          box.innerHTML = "";
          box.appendChild(buildTable(f));
          if (box.scrollHeight <= box.clientHeight + 0.5) { placed = true; break; }
        }
        if (!placed) {
          box.innerHTML = "";
          var more = document.createElement("div");
          more.className = "more";
          more.textContent = "تفاصيل المنتجات في البوليصة التالية";
          box.appendChild(more);
        }
      }
    }

    // Didn't fit (or no REMARKS box) → table on its own label right after
    if (data.items.length && !placed) {
      var extra = document.createElement("div");
      extra.className = "page";
      extra.style.padding = "8pt";
      extra.style.direction = "rtl";
      extra.appendChild(buildTable(9));
      document.body.appendChild(extra);
    }

    document.getElementById("status").remove();
    await new Promise(function (r) { if (img.complete) r(); else img.onload = r; });
    ${autoPrint ? 'setTimeout(function () { window.print(); }, 200);' : 'document.title = "معاينة البوليصة";'}
  } catch (e) {
    console.error(e);
    location.replace(fallback);
  }
})();
</script></body></html>`;
}
