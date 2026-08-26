"use client";

import React, { useEffect } from "react";
import type { Order } from "@/lib/types";

interface Props { order: Order }

/* ── SVG Barcode (Code-like pattern from string) ── */
function SvgBarcode({ value, width = 200, height = 50 }: { value: string; width?: number; height?: number }) {
  const bars: { x: number; w: number; dark: boolean }[] = [];
  let x = 0;
  const unit = width / (value.length * 11 + 20);
  // Encode each char as alternating bars
  [...value].forEach((ch) => {
    const code = ch.charCodeAt(0);
    for (let b = 0; b < 9; b++) {
      const w = unit * ((code >> b & 1) ? 2 : 1);
      bars.push({ x, w, dark: b % 2 === 0 });
      x += w + unit * 0.3;
    }
    x += unit;
  });
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} xmlns="http://www.w3.org/2000/svg">
      {bars.map((b, i) => b.dark && (
        <rect key={i} x={b.x} y={0} width={b.w} height={height} fill="#000" />
      ))}
    </svg>
  );
}

export function PrintLabelClient({ order }: Props) {
  const tracking = order.autoTrackingNumber ?? order.trackingNumber ?? `XENO${order.orderNumber.replace("#", "")}`;
  const today = new Date().toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });

  useEffect(() => {
    const t = setTimeout(() => window.print(), 600);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          background: #e5e7eb;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          font-family: 'Cairo', Arial, sans-serif;
        }

        .toolbar {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
        }

        .toolbar button {
          padding: 8px 20px;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
        }

        .btn-print { background: #2563eb; color: white; }
        .btn-close { background: #e5e7eb; color: #374151; }

        /* ── The Label ── */
        .label {
          width: 80mm;
          min-height: 130mm;
          background: white;
          display: flex;
          flex-direction: column;
          border: 1px solid #d1d5db;
          box-shadow: 0 4px 24px rgba(0,0,0,0.15);
          overflow: hidden;
          direction: rtl;
        }

        /* Sections */
        .label-header {
          background: #0f172b;
          color: white;
          padding: 3mm 4mm;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .label-brand {
          font-size: 15pt;
          font-weight: 900;
          letter-spacing: 3px;
          color: white;
        }

        .label-brand-sub {
          font-size: 6pt;
          color: #94a3b8;
          letter-spacing: 1px;
          margin-top: 1px;
        }

        .label-provider {
          text-align: left;
          font-size: 7pt;
          color: #94a3b8;
        }

        .label-provider strong { color: white; font-size: 8pt; display: block; }

        .label-tracking {
          padding: 3mm 4mm;
          border-bottom: 0.5mm solid #e5e7eb;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1mm;
        }

        .label-tracking-num {
          font-size: 12pt;
          font-weight: 900;
          letter-spacing: 2px;
          direction: ltr;
          font-family: 'Courier New', monospace;
        }

        .label-order-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 2mm 4mm;
          background: #f8fafc;
          border-bottom: 0.5mm solid #e5e7eb;
          font-size: 8pt;
        }

        .label-order-row .label-order-num {
          font-weight: 900;
          font-size: 10pt;
          letter-spacing: 1px;
          direction: ltr;
        }

        .label-order-row .label-date {
          color: #64748b;
          font-size: 7pt;
        }

        .label-section {
          padding: 2mm 4mm;
          border-bottom: 0.3mm solid #e5e7eb;
        }

        .label-section-title {
          font-size: 6pt;
          font-weight: 700;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 1.5mm;
        }

        .label-customer-name {
          font-size: 12pt;
          font-weight: 800;
          color: #0f172b;
          line-height: 1.2;
        }

        .label-customer-phone {
          font-size: 9pt;
          color: #374151;
          direction: ltr;
          display: inline-block;
          margin-top: 1mm;
          font-weight: 600;
        }

        .label-customer-address {
          font-size: 8pt;
          color: #4b5563;
          margin-top: 1mm;
          line-height: 1.4;
        }

        .label-product-row {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          font-size: 7.5pt;
          padding: 0.8mm 0;
          border-bottom: 0.2mm dashed #e5e7eb;
        }

        .label-product-row:last-child { border-bottom: none; }

        .label-product-name { color: #1e293b; flex: 1; }
        .label-product-sku  { color: #64748b; font-size: 6.5pt; direction: ltr; margin-right: 2mm; }
        .label-product-qty  { font-weight: 700; color: #0f172b; flex-shrink: 0; }

        .label-total {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 2mm 4mm;
          background: #0f172b;
          color: white;
          margin-top: auto;
        }

        .label-total-label { font-size: 7pt; color: #94a3b8; }
        .label-total-value { font-size: 11pt; font-weight: 900; direction: ltr; }

        .label-footer {
          padding: 1.5mm 4mm;
          text-align: center;
          font-size: 6pt;
          color: #94a3b8;
          background: #f8fafc;
        }

        /* ── Print ── */
        @media print {
          body { background: white; display: block; }
          .toolbar { display: none !important; }
          .label {
            width: 80mm;
            min-height: 130mm;
            box-shadow: none;
            border: none;
            margin: 0;
          }
          @page {
            size: 80mm 130mm;
            margin: 0;
          }
        }
      `}</style>

      {/* Screen toolbar */}
      <div className="toolbar">
        <button className="btn-print" onClick={() => window.print()}>طباعة البوليصة</button>
        <button className="btn-close" onClick={() => window.history.back()}>رجوع</button>
      </div>

      {/* ══ LABEL ══ */}
      <div className="label">

        {/* Header */}
        <div className="label-header">
          <div>
            <div className="label-brand">XENO</div>
            <div className="label-brand-sub">INVENTORY OS</div>
          </div>
          <div className="label-provider">
            <strong>{order.shippingProvider ?? "J&T Express"}</strong>
            شركة الشحن
          </div>
        </div>

        {/* Tracking barcode */}
        <div className="label-tracking">
          <SvgBarcode value={tracking} width={240} height={45} />
          <div className="label-tracking-num">{tracking}</div>
        </div>

        {/* Order number + date */}
        <div className="label-order-row">
          <div>
            <div style={{ fontSize: "6pt", color: "#94a3b8" }}>رقم الطلب</div>
            <div className="label-order-num">{order.orderNumber}</div>
          </div>
          <div className="label-date">{today}</div>
        </div>

        {/* Customer */}
        <div className="label-section">
          <div className="label-section-title">المستلم</div>
          <div className="label-customer-name">{order.customerName}</div>
          <div className="label-customer-phone">{order.customerPhone}</div>
          <div className="label-customer-address">
            {order.address}<br />
            {order.city}، {order.governorate}
          </div>
        </div>

        {/* Products */}
        <div className="label-section" style={{ flex: 1 }}>
          <div className="label-section-title">المنتجات ({order.items.length})</div>
          {order.items.map((item) => (
            <div key={item.id} className="label-product-row">
              <div className="label-product-name">
                {item.productName}
                {item.variant && <span style={{ color: "#94a3b8" }}> · {item.variant}</span>}
              </div>
              <div className="label-product-sku">{item.sku}</div>
              <div className="label-product-qty">×{item.quantity}</div>
            </div>
          ))}
        </div>

        {/* Total */}
        <div className="label-total">
          <div className="label-total-label">الإجمالي المطلوب</div>
          <div className="label-total-value" dir="ltr">
            {order.total.toLocaleString("en-US")} ج.م
          </div>
        </div>

        {/* Footer */}
        <div className="label-footer">
          XENO Inventory OS · Made by Websity
        </div>

      </div>
    </>
  );
}
