// Client helper: print an order's J&T waybill. Going through J&T's print API is what
// moves the order to "Printed" on their side, so every print button should use this.
// Must be called directly from a click handler (it opens the tab before awaiting).

export interface LabelItem { qty: number; name: string; color: string; size: string; sku: string }
export interface LabelSender { name: string; phone: string; city: string }

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
      writeLabelPage(win, data.pdfBase64, data.items ?? [], !opts.preview, data.sender ?? null);
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
function writeLabelPage(win: Window, pdfBase64: string, items: LabelItem[], autoPrint: boolean, sender: LabelSender | null) {
  win.document.open();
  win.document.write(labelPageHtml(pdfBase64, items, base64PdfUrl(pdfBase64), autoPrint, sender));
  win.document.close();
}

export function labelPageHtml(pdfBase64: string, items: LabelItem[], fallbackUrl: string, autoPrint = true, sender: LabelSender | null = null): string {
  const payload = JSON.stringify({ pdf: pdfBase64, items, sender }).replace(/</g, "\\u003c");
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
  .note { font: 11px monospace; color: #666; text-align: center; direction: ltr; padding: 4px 16px; }
  @media print { #status, .note { display: none; } }
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
    var layoutNote = "";
    function fail(reason) { layoutNote = reason; return null; }
    function compactLayout() {
      if (!cods || !remarks || !footer) return fail("text: cods=" + !!cods + " remarks=" + !!remarks + " footer=" + !!footer);
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
      if (!lCods || !lRem || !lFoot || !(lCods.bottom < lRem.top && lRem.bottom < lFoot.top)) {
        return fail("lines: n=" + lines.length + " cods=" + (lCods && lCods.top) + " rem=" + (lRem && lRem.top) + " foot=" + (lFoot && lFoot.top));
      }

      // The address band sits between the Cods row and REMARKS
      var y0 = lCods.bottom + 1, y1 = lRem.top, bandH = y1 - y0;
      if (bandH < 20 * S) return fail("band too small: " + bandH);
      var vruns = [], vr = null;
      for (var x2 = 0; x2 < Wp; x2++) {
        var d = 0;
        for (var y2 = y0; y2 < y1; y2 += 2) if (lum(x2, y2) < 128) d++;
        if (d / (bandH / 2) > 0.9) { if (vr) vr.right = x2; else vr = { left: x2, right: x2 }; }
        else if (vr) { vruns.push(vr); vr = null; }
      }
      if (vr) vruns.push(vr);
      // J&T's label has no outer vertical borders — use the page edges then
      var leftB = vruns.length && vruns[0].right < Wp * 0.1 ? vruns[0] : { left: -1, right: -1 };
      var lastV = vruns[vruns.length - 1];
      var rightB = lastV && lastV.left > Wp * 0.9 ? lastV : { left: Wp, right: Wp };
      var sep = null;
      vruns.forEach(function (v) { if (!sep && v.left > Wp * 0.55 && v.right < rightB.left - S) sep = v; });
      if (!sep) layoutNote = "no barcode column: v=" + vruns.map(function (v) { return v.left; }).join(",") + " W=" + Wp;

      // 1) Drop the sideways barcode column and its divider, and run the section lines
      //    (under the sorting code / receiver) across the full width
      if (sep) {
        var lineRows = [];
        for (var yl = y0; yl < y1; yl++) {
          var dk = 0, n = 0;
          for (var xl = leftB.right + 2; xl < sep.left - 1; xl += 2) { n++; if (lum(xl, yl) < 128) dk++; }
          if (n && dk / n > 0.9) lineRows.push(yl);
        }
        ctx.fillStyle = "#fff";
        ctx.fillRect(sep.left, y0, rightB.left - sep.left, bandH);
        ctx.fillStyle = "#000";
        lineRows.forEach(function (yl2) { ctx.fillRect(sep.left, yl2, rightB.left - sep.left, 1); });
        px = ctx.getImageData(0, 0, Wp, Hp).data;
        vruns = vruns.filter(function (v) { return v !== sep; });
      }

      // 1b) Receiver: centre each line (closing the big gap between name and phone).
      //     Sender: one centred line "FROM: XENO  phone  city" instead of J&T's block.
      try { restyleAddress(); } catch (e) { layoutNote = "address: " + (e && e.message); }
      px = ctx.getImageData(0, 0, Wp, Hp).data;
      function restyleAddress() {
        var toItem = null, fromItem = null;
        text.items.forEach(function (t) {
          var s = (t.str || "").trim().toLowerCase();
          if (!toItem && s.slice(0, 3) === "to:") toItem = t;
          if (!fromItem && s.slice(0, 4) === "from") fromItem = t;
        });
        if (!toItem || !fromItem) { layoutNote = "address: no To/FROM text"; return; }
        function topPx(t) { return (H - t.transform[5] - t.height) * S; }
        function basePx(t) { return (H - t.transform[5]) * S; }
        // section lines inside the band (full width now that the side column is gone)
        var rows = [];
        for (var yy = y0; yy < y1; yy++) {
          var dk = 0, n = 0;
          for (var xx = leftB.right + 2; xx < rightB.left - 2; xx += 3) { n++; if (lum(xx, yy) < 128) dk++; }
          if (n && dk / n > 0.85) rows.push(yy);
        }
        function lineAboveY(yPx) {
          var r = -1;
          rows.forEach(function (v) { if (v < yPx && v > r) r = v; });
          if (r < 0) return null;
          var top = r;
          while (rows.indexOf(top - 1) >= 0) top--;
          return { top: top, bottom: r };
        }
        var aboveTo = lineAboveY(topPx(toItem)), aboveFrom = lineAboveY(topPx(fromItem));
        if (!aboveFrom || (aboveTo && aboveTo.bottom >= aboveFrom.top)) { layoutNote = "address: section lines"; return; }
        var toBox = { top: aboveTo ? aboveTo.bottom + 1 : y0, bottom: aboveFrom.top - 1 };
        var fromBox = { top: aboveFrom.bottom + 1, bottom: y1 - 1 };
        var inL = leftB.right + 1, inR = rightB.left - 1, mid = (inL + inR) / 2;

        // Receiver lines → segments of nearby text items → re-placed centred
        var toItems = text.items.filter(function (t) {
          var b = basePx(t);
          return (t.str || "").trim() && t.width > 0 && b > toBox.top && b < toBox.bottom;
        });
        var lines2 = [];
        toItems.sort(function (a, b) { return basePx(a) - basePx(b); }).forEach(function (t) {
          var ln = lines2.find(function (l) { return Math.abs(l.base - basePx(t)) < 2 * S; });
          if (ln) ln.items.push(t); else lines2.push({ base: basePx(t), items: [t] });
        });
        var pieces = [];
        lines2.forEach(function (ln) {
          ln.items.sort(function (a, b) { return a.transform[4] - b.transform[4]; });
          var h = Math.max.apply(null, ln.items.map(function (t) { return t.height; })) * S;
          var top = Math.max(toBox.top + 1, Math.round(ln.base - h * 1.05));
          var bottom = Math.min(toBox.bottom - 1, Math.round(ln.base + h * 0.35));
          var segs = [];
          ln.items.forEach(function (t) {
            var x0 = Math.floor(t.transform[4] * S) - 2, x1 = Math.ceil((t.transform[4] + t.width) * S) + 2;
            var last = segs[segs.length - 1];
            if (last && x0 - last.x1 < 6 * S) last.x1 = Math.max(last.x1, x1); else segs.push({ x0: x0, x1: x1 });
          });
          segs.forEach(function (sg) {
            sg.x0 = Math.max(inL, sg.x0); sg.x1 = Math.min(inR, sg.x1);
            var cv2 = document.createElement("canvas");
            cv2.width = Math.max(1, sg.x1 - sg.x0); cv2.height = Math.max(1, bottom - top);
            cv2.getContext("2d").drawImage(canvas, sg.x0, top, cv2.width, cv2.height, 0, 0, cv2.width, cv2.height);
            sg.cv = cv2;
          });
          pieces.push({ top: top, segs: segs });
        });
        ctx.fillStyle = "#fff";
        ctx.fillRect(inL, toBox.top, inR - inL, toBox.bottom - toBox.top);
        var gap = 8 * S;
        pieces.forEach(function (pc) {
          var total = pc.segs.reduce(function (a, sg) { return a + sg.cv.width; }, 0) + gap * (pc.segs.length - 1);
          var x = Math.max(inL, mid - total / 2);
          pc.segs.forEach(function (sg) { ctx.drawImage(sg.cv, x, pc.top); x += sg.cv.width + gap; });
        });

        // Sender → one line drawn by us (keeps J&T's FROM line if we have no sender data)
        var snd = data.sender;
        if (!snd || !snd.name) return;
        ctx.fillStyle = "#fff";
        ctx.fillRect(inL, fromBox.top, inR - inL, fromBox.bottom - fromBox.top);
        var fs = fromItem.height * S * 1.1;
        var parts = ["FROM: " + snd.name, snd.phone, snd.city].filter(function (p) { return p; });
        ctx.font = "700 " + fs + "px Arial";
        ctx.direction = "ltr";
        var sp = fs * 1.4;
        var widths = parts.map(function (p) { return ctx.measureText(p).width; });
        var tot = widths.reduce(function (a, w) { return a + w; }, 0) + sp * (parts.length - 1);
        var xx2 = mid - tot / 2;
        ctx.fillStyle = "#000"; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
        var by2 = fromBox.top + fs * 1.25;
        parts.forEach(function (p, i) { ctx.fillText(p, xx2, by2); xx2 += widths[i] + sp; });
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
      //    → XENO brand strip at the very bottom
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
      // J&T's footer row (hotline + print date) moves into our black strip
      var BRAND = Math.round(24 * S);
      var footTop = Hp - BRAND;
      var phone = "";
      text.items.forEach(function (t) {
        var s2 = (t.str || "").trim();
        if (t !== footer && /^[0-9]{3,}$/.test(s2) && Math.abs(t.transform[5] - footer.transform[5]) < 4) phone = s2;
      });
      var filler = document.createElement("canvas");
      filler.width = Wp; filler.height = 1;
      var f = filler.getContext("2d");
      f.drawImage(canvas, 0, lFoot.top - 3, Wp, 1, 0, 0, Wp, 1);
      f.fillStyle = "#fff"; f.fillRect(leftB.right + 1, 0, rightB.left - leftB.right - 1, 1);
      if (footTop > dy) o.drawImage(filler, 0, 0, Wp, 1, 0, dy, Wp, footTop - dy);

      // 5) Brand strip: XENO · ☎ hotline · print date · ///
      var by = Hp - BRAND;
      o.fillStyle = "#000";
      o.fillRect(0, by, Wp, BRAND);
      o.fillStyle = "#fff"; o.textBaseline = "middle"; o.textAlign = "left";
      o.font = "900 " + (BRAND * 0.5) + "px 'Arial Black', Arial, sans-serif";
      o.fillText("XENO", 6 * S, by + BRAND / 2);
      var logoEnd = 6 * S + o.measureText("XENO").width;
      var stripesW = 3 * BRAND * 0.32;
      o.font = "600 " + (BRAND * 0.3) + "px Arial";
      if (phone) {
        var px0 = logoEnd + 10 * S;
        o.font = (BRAND * 0.36) + "px 'Segoe UI Symbol', 'Noto Sans Symbols', Arial";
        o.fillText("☎", px0, by + BRAND / 2);
        var iconW = o.measureText("☎").width;
        o.font = "600 " + (BRAND * 0.3) + "px Arial";
        o.fillText(phone, px0 + iconW + 2 * S, by + BRAND / 2);
      }
      o.textAlign = "right";
      o.fillText(footer.str.trim(), Wp - 8 * S - stripesW - 8 * S, by + BRAND / 2);
      o.fillStyle = "#bbb";
      for (var k2 = 0; k2 < 3; k2++) {
        var sx = Wp - 8 * S - (3 - k2) * BRAND * 0.32;
        o.beginPath();
        o.moveTo(sx, by + BRAND * 0.72); o.lineTo(sx + BRAND * 0.16, by + BRAND * 0.72);
        o.lineTo(sx + BRAND * 0.42, by + BRAND * 0.28); o.lineTo(sx + BRAND * 0.26, by + BRAND * 0.28);
        o.closePath(); o.fill();
      }

      return {
        canvas: out,
        top: tableTop / S, bottom: (footTop - 2) / S,
      };
    }
    var layout = null;
    try { layout = compactLayout(); } catch (e) { console.error(e); layoutNote = "error: " + (e && e.message); layout = null; }

    // Header per the mockup: corner stripe + XENO logo in the empty top-left area,
    // J&T's grey COD badge turned black, a rule under "Order No.". Found from pixels,
    // since the badge is drawn as an image rather than text.
    var headerNote = "";
    function brandHeader(cv) {
      var S = SCALE, c = cv.getContext("2d", { willReadFrequently: true });
      var Wp = cv.width;
      var orderNo = null;
      text.items.forEach(function (t) { if (!orderNo && /^order no/i.test((t.str || "").trim())) orderNo = t; });
      // Bottom of the header area: just above "Order No." (or the top 9% of the page)
      var y1 = Math.round(orderNo ? (H - orderNo.transform[5] - orderNo.height - 2.5) * S : H * 0.09 * S);
      var y0 = Math.round(3 * S);
      if (y1 - y0 < 18 * S) { headerNote = "header too short: " + (y1 - y0); return false; }
      var hh = y1 - y0;
      var d = c.getImageData(0, y0, Wp, hh).data;
      function L(x, y) { var i = (y * Wp + x) * 4; return (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000; }

      // Leftmost ink in the header area = where J&T's own content (badge) starts
      var inkLeft = Wp;
      for (var y = 0; y < hh; y += 2) for (var x = Math.round(3 * S); x < inkLeft; x++) if (L(x, y) < 170) { inkLeft = x; break; }
      var x1 = inkLeft - 9 * S;
      if (x1 < 90 * S) { headerNote = "no empty corner: inkLeft=" + Math.round(inkLeft / S) + "pt"; return false; }

      // Grey badge → black (white lettering stays white)
      var colCount = [], gL = -1, gR = -1;
      for (var x2 = inkLeft; x2 < Wp; x2++) {
        var g = 0;
        for (var y2 = 0; y2 < hh; y2++) { var l = L(x2, y2); if (l > 50 && l < 215) g++; }
        colCount.push(g);
        if (g > hh * 0.35) { if (gL < 0) gL = x2; gR = x2; } else if (gL >= 0 && x2 - gR > 4 * S) break;
      }
      if (gL >= 0 && gR - gL > 15 * S) {
        var gT = -1, gB = -1;
        for (var y3 = 0; y3 < hh; y3++) {
          var g2 = 0;
          for (var x3 = gL; x3 <= gR; x3++) { var l2 = L(x3, y3); if (l2 > 50 && l2 < 215) g2++; }
          if (g2 > (gR - gL) * 0.35) { if (gT < 0) gT = y3; gB = y3; }
        }
        if (gT >= 0) {
          // include the badge's anti-aliased edge rows/columns
          gL = Math.max(0, gL - 2); gR = Math.min(Wp - 1, gR + 2); gT = Math.max(0, gT - 2); gB = Math.min(hh - 1, gB + 2);
          var bw = gR - gL + 1, bh = gB - gT + 1;
          var img2 = c.getImageData(gL, y0 + gT, bw, bh);
          for (var k = 0; k < img2.data.length; k += 4) {
            var lk = (img2.data[k] * 299 + img2.data[k + 1] * 587 + img2.data[k + 2] * 114) / 1000;
            var v = lk > 225 ? 255 : 0;
            img2.data[k] = img2.data[k + 1] = img2.data[k + 2] = v;
          }
          c.putImageData(img2, gL, y0 + gT);
        }
      }

      // Corner stripe + logo + divider
      c.fillStyle = "#000";
      c.beginPath();
      c.moveTo(0, 13 * S); c.lineTo(13 * S, 0); c.lineTo(18 * S, 0); c.lineTo(0, 18 * S);
      c.closePath(); c.fill();
      var x0 = 20 * S, w = x1 - x0;
      c.textAlign = "center"; c.textBaseline = "alphabetic";
      var size = hh * 0.62;
      c.font = "900 " + size + "px 'Arial Black', Arial, sans-serif";
      var tw = c.measureText("XENO").width;
      if (tw > w * 0.82) { size = size * w * 0.82 / tw; c.font = "900 " + size + "px 'Arial Black', Arial, sans-serif"; tw = c.measureText("XENO").width; }
      var cx = (x0 + x1) / 2, base = y0 + size * 0.86;
      c.fillText("XENO", cx, base);
      c.font = (size * 0.2) + "px Arial";
      c.fillText("®", cx + tw / 2 + size * 0.1, y0 + size * 0.22);
      c.font = "600 " + (size * 0.17) + "px Arial";
      if ("letterSpacing" in c) c.letterSpacing = (size * 0.12) + "px";
      c.fillText("PREMIUM APPAREL", cx, Math.min(y1 - 1, base + size * 0.36));
      if ("letterSpacing" in c) c.letterSpacing = "0px";
      c.fillRect(x1 + 3 * S, y0, 0.8 * S, hh);

      // Thin rule under "Order No." when there's a clear gap above the barcode
      if (orderNo) {
        var ry = Math.round((H - orderNo.transform[5] + 2.5) * S);
        var rd = c.getImageData(3 * S, ry - S, Wp - 6 * S, 2 * S).data, clear = true;
        for (var j = 0; j < rd.length; j += 16) if (rd[j] < 170) { clear = false; break; }
        if (clear) c.fillRect(3 * S, ry, Wp - 6 * S, 0.8 * S);
      }
      return true;
    }
    var finalCanvas = layout ? layout.canvas : canvas;
    var headerLogo = false;
    try { headerLogo = brandHeader(finalCanvas); } catch (e) { console.error(e); }

    var sheet = document.createElement("div");
    sheet.className = "page";
    var img = new Image();
    img.src = finalCanvas.toDataURL("image/png");
    sheet.appendChild(img);
    document.body.appendChild(sheet);

    // Relabel J&T's English fields: "Cods" → "المبلغ", amount → "900 L.E", and the
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
        writeAt(amount, (n % 1 ? n.toFixed(2) : String(n)) + " L.E", true);
      }
    }
    if (fod) { coverItem(fod); writeAt(fod, "COD", false); }

    function buildTable(fontPt) {
      var table = document.createElement("table");
      table.style.fontSize = fontPt + "pt";
      // No barcode column to hold the company name → put it above the table
      if (!headerLogo) {
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
    // Preview only: say why the compact layout wasn't used (screen, never printed)
    if (headerNote) layoutNote = (layoutNote ? layoutNote + " | " : "") + headerNote;
    if (${!autoPrint} && layoutNote) {
      var note = document.createElement("div");
      note.className = "note";
      note.textContent = "layout: " + layoutNote;
      document.body.appendChild(note);
    }
    await new Promise(function (r) { if (img.complete) r(); else img.onload = r; });
    ${autoPrint ? 'setTimeout(function () { window.print(); }, 200);' : 'document.title = "معاينة البوليصة";'}
  } catch (e) {
    console.error(e);
    location.replace(fallback);
  }
})();
</script></body></html>`;
}
