"use client";

import React, { useState } from "react";
import { CheckCircle2, Loader2, MessageSquare, Truck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import type { XenoOrder } from "@/lib/shopify/orders";

// ── Ship Modal ────────────────────────────────────────────────────────────────
export interface ShipModalProps {
  open:    boolean;
  order:   XenoOrder;
  onClose: () => void;
  onDone:  (trackingNumber: string) => void;
}

export function ShipModal({ open, order, onClose, onDone }: ShipModalProps) {
  const [step,     setStep]     = useState<"confirm" | "loading" | "success">("confirm");
  const [tracking, setTracking] = useState("");
  const [errMsg,   setErrMsg]   = useState("");
  const [already,  setAlready]  = useState(false);
  const { error } = useToast();

  async function ship() {
    setStep("loading");
    setErrMsg("");
    try {
      const res = await fetch("/api/confirmation/ship", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          orders: [{
            shopify_order_id: order.shopifyId,
            order_number:     order.orderNumber,
            customer_name:    order.customerName,
            phone:            order.customerPhone,
            address:          order.address,
            city:             order.city,
            governorate:      order.governorate,
            total:            order.total,
          }],
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.results?.[0]?.error ?? data.error ?? "فشل الإرسال");

      const r = data.results?.[0];
      if (r?.trackingNumber) {
        setTracking(r.trackingNumber);
        setAlready(Boolean(r.skipped));
        setStep("success");
        onDone(r.trackingNumber);
      } else {
        throw new Error(r?.error ?? "لم يُرجع رقم تتبع");
      }
    } catch (err) {
      setErrMsg(String(err));
      setStep("confirm");
      error("فشل الإرسال للشحن", String(err));
    }
  }

  function close() { setStep("confirm"); setTracking(""); setErrMsg(""); setAlready(false); onClose(); }

  return (
    <Modal open={open} onClose={step === "loading" ? () => {} : close}
      title={step === "success" ? "تم الإرسال للشحن ✅" : "إرسال الطلب لـ J&T Express"}
      size="md"
      footer={
        step === "confirm" ? (
          <>
            <Button variant="secondary" onClick={close}>إلغاء</Button>
            <Button variant="primary" onClick={ship} icon={<Truck size={14} />}>تأكيد الإرسال</Button>
          </>
        ) : step === "success" ? (
          <Button variant="primary" onClick={close}>إغلاق</Button>
        ) : undefined
      }
    >
      {step === "confirm" && (
        <div className="space-y-4">
          <div className="bg-[var(--bg-base)] rounded-[var(--radius-lg)] p-4 space-y-2.5">
            {[
              ["رقم الطلب",  order.orderNumber],
              ["العميل",     order.customerName],
              ["الهاتف",     order.customerPhone],
              ["العنوان",    `${order.address}، ${order.city}`],
              ["المحافظة",   order.governorate],
              ["الإجمالي",   `${order.total.toLocaleString("en-US")} ج.م`],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between text-sm">
                <span className="text-xs text-[var(--text-muted)]">{label}</span>
                <span className="text-xs font-semibold text-[var(--text-primary)]">{value}</span>
              </div>
            ))}
          </div>
          {errMsg && (
            <div className="text-xs text-[var(--danger)] bg-[var(--danger-light)] border border-[var(--danger-border)] rounded-[var(--radius-md)] p-3">
              {errMsg}
            </div>
          )}
          <p className="text-xs text-[var(--text-muted)] bg-[var(--warning-light)] border border-[var(--warning-border)] rounded-[var(--radius-md)] p-3">
            سيتم إنشاء شحنة J&T Express وإرسال رقم التتبع تلقائياً للعميل على واتساب
          </p>
        </div>
      )}

      {step === "loading" && (
        <div className="flex flex-col items-center gap-4 py-10">
          <Loader2 size={36} className="animate-spin text-[var(--primary)]" />
          <p className="text-sm text-[var(--text-secondary)] font-medium">جارٍ إنشاء الشحنة على J&T...</p>
        </div>
      )}

      {step === "success" && (
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="w-14 h-14 rounded-full bg-[var(--success-light)] flex items-center justify-center">
              <CheckCircle2 size={30} className="text-[var(--success)]" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-[var(--text-primary)]">{already ? "الطلب مشحون بالفعل" : "تم إنشاء الشحنة بنجاح"}</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                رقم التتبع: <span className="font-mono font-bold text-[var(--primary)]">{tracking}</span>
              </p>
            </div>
          </div>
          {!already && (
            <div className="flex items-center gap-3 bg-[var(--success-light)] border border-[var(--success-border)] rounded-[var(--radius-md)] p-3">
              <MessageSquare size={15} className="text-[var(--success)]" />
              <p className="text-xs text-[var(--success-text)]">تم إرسال رقم التتبع للعميل على واتساب</p>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
