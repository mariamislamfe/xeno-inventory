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

    var cods = null, fod = null;
    text.items.forEach(function (t) {
      var s = (t.str || "").trim();
      if (!cods && /^cods$/i.test(s)) cods = t; // not the big "COD" badge
      if (!fod && /^fod$/i.test(s)) fod = t;
    });

    // Make room for the items table: drop the sideways barcode (the main barcode stays
    // on top), write XENO in its place, squeeze the empty gaps in the address section,
    // and give the freed height to the REMARKS box. Works on the rendered pixels; any
    // surprise in the layout returns null and the label is used as J&T made it.
    function compactLayout() {
      if (!cods || !remarks || !footer) return null;
      var ctx = canvas.getContext("2d", { willReadFrequently: true });
      var Wp = canvas.width, Hp = canvas.height, S = SCALE;
      var px = ctx.getImageData(0, 0, Wp, Hp).data;
      function lum(x, y) { var i = (y * Wp + x) * 4; return (px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114) / 1000; }

      // Full-width horizontal lines (row borders)
      var lines = [], run = null;
      for (var y = 0; y < Hp; y++) {
        var dark = 0;
        for (var x = 0; x < Wp; x += 2) if (lum(x, y) < 128) dark++;
        if (dark / (Wp / 2) > 0.85) { if (run) run.bottom = y; else run = { top: y, bottom: y }; }
        else if (run) { lines.push(run); run = null; }
      }
      if (run) lines.push(run);
      function lineAbove(yPx) { var b = null; lines.forEach(function (l) { if (l.bottom < yPx && (!b || l.bottom > b.bottom)) b = l; }); return b; }
      function lineBelow(yPx) { var b = null; lines.forEach(function (l) { if (l.top > yPx && (!b || l.top < b.top)) b = l; }); return b; }
      var lCods = lineBelow((H - cods.transform[5]) * S);
      var lRem  = lineAbove((H - remarks.transform[5] - remarks.height) * S);
      var lFoot = lineAbove((H - footer.transform[5] - footer.height) * S);
      if (!lCods || !lRem || !lFoot || !(lCods.bottom < lRem.top && lRem.bottom < lFoot.top)) return null;

      // The address band sits between the Cods row and REMARKS
      var y0 = lCods.bottom + 1, y1 = lRem.top, bandH = y1 - y0;
      if (bandH < 20 * S) return null;
      var vruns = [], vr = null;
      for (var x2 = 0; x2 < Wp; x2++) {
        var d = 0;
        for (var y2 = y0; y2 < y1; y2 += 2) if (lum(x2, y2) < 128) d++;
        if (d / (bandH / 2) > 0.9) { if (vr) vr.right = x2; else vr = { left: x2, right: x2 }; }
        else if (vr) { vruns.push(vr); vr = null; }
      }
      if (vr) vruns.push(vr);
      if (vruns.length < 2) return null;
      var leftB = vruns[0], rightB = vruns[vruns.length - 1];
      if (leftB.left > Wp * 0.1 || rightB.right < Wp * 0.9) return null;
      var sep = null;
      vruns.forEach(function (v) { if (!sep && v.left > Wp * 0.55 && v.right < rightB.left - S) sep = v; });

      // 1) Blank the sideways barcode column
      if (sep) {
        ctx.fillStyle = "#fff";
        ctx.fillRect(sep.right + 1, y0, rightB.left - sep.right - 1, bandH);
        px = ctx.getImageData(0, 0, Wp, Hp).data;
      }

      // 2) Find empty rows in the band (ignoring the vertical borders) and cut the gaps
      function rowBlank(yy) {
        for (var xx = leftB.right + 3; xx < rightB.left - 2; xx++) {
          var onLine = false;
          for (var k = 0; k < vruns.length; k++) {
            if (xx >= vruns[k].left - 2 && xx <= vruns[k].right + 2) { onLine = true; break; }
          }
          if (!onLine && lum(xx, yy) < 170) return false;
        }
        return true;
      }
      var pad = Math.round(2.5 * S), cuts = [], start = -1;
      for (var y3 = y0; y3 <= y1; y3++) {
        var blank = y3 < y1 && rowBlank(y3);
        if (blank && start < 0) start = y3;
        if (!blank && start >= 0) {
          if (y3 - start > 2 * pad + S) cuts.push([start + pad, y3 - pad]);
          start = -1;
        }
      }

      // 3) Re-stack: band without the gaps → REMARKS title → stretched REMARKS box → footer
      var out = document.createElement("canvas");
      out.width = Wp; out.height = Hp;
      var o = out.getContext("2d");
      o.fillStyle = "#fff"; o.fillRect(0, 0, Wp, Hp);
      var dy = 0, sy = 0;
      function copy(from, to) {
        if (to > from) { o.drawImage(canvas, 0, from, Wp, to - from, 0, dy, Wp, to - from); dy += to - from; }
      }
      cuts.forEach(function (c) { copy(sy, c[0]); sy = c[1]; });
      copy(sy, y1);
      var bandBottom = dy;
      copy(y1, Math.round((H - remarks.transform[5] + 1.5) * S));
      var tableTop = dy;
      var filler = document.createElement("canvas");
      filler.width = Wp; filler.height = 1;
      var f = filler.getContext("2d");
      f.drawImage(canvas, 0, lFoot.top - 3, Wp, 1, 0, 0, Wp, 1);
      f.fillStyle = "#fff"; f.fillRect(leftB.right + 1, 0, rightB.left - leftB.right - 1, 1);
      if (lFoot.top > dy) o.drawImage(filler, 0, 0, Wp, 1, 0, dy, Wp, lFoot.top - dy);
      o.drawImage(canvas, 0, lFoot.top, Wp, Hp - lFoot.top, 0, lFoot.top, Wp, Hp - lFoot.top);

      // 4) XENO where the sideways barcode was
      if (sep) {
        var colW = rightB.left - sep.right, colH = bandBottom - y0;
        var size = colW * 0.7;
        o.save();
        o.translate((sep.right + rightB.left) / 2, (y0 + bandBottom) / 2);
        o.rotate(-Math.PI / 2);
        o.font = "bold " + size + "px Arial";
        var tw = o.measureText("XENO").width;
        if (tw > colH * 0.85) { size = size * colH * 0.85 / tw; o.font = "bold " + size + "px Arial"; }
        o.fillStyle = "#000"; o.textAlign = "center"; o.textBaseline = "middle";
        o.fillText("XENO", 0, 0);
        o.restore();
      }

      return {
        canvas: out,
        top: tableTop / S, bottom: (lFoot.top - 2) / S,
        xeno: !!sep,
      };
    }
    var layout = null;
    try { layout = compactLayout(); } catch (e) { console.error(e); layout = null; }

    var sheet = document.createElement("div");
    sheet.className = "page";
    var img = new Image();
    img.src = (layout ? layout.canvas : canvas).toDataURL("image/png");
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
      // No barcode column to hold the company name → put it above the table
      if (!(layout && layout.xeno)) {
        var cap = table.createCaption();
        cap.textContent = "XENO";
        cap.style.fontWeight = "700";
        cap.style.fontSize = (fontPt + 2) + "pt";
      }
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
    if (data.items.length && (layout || (remarks && footer))) {
      var top = layout ? layout.top : H - remarks.transform[5] + 1.5;                    // just under the "REMARKS" title
      var bottom = layout ? layout.bottom : H - (footer.transform[5] + footer.height) - 9; // above the footer row line
      if (bottom - top > 18) {
        // Blank out J&T's one-line remark text, leaving the box borders alone
        // (the compacted layout already rebuilt the box empty)
        if (!layout && remarkBottom !== null) {
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
