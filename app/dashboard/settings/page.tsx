"use client";

import React, { useState } from "react";
import {
  Save, Store, Truck, ShoppingBag, MessageSquare, Bell, Lock,
  Building2, Printer, Package, BarChart2, Shield,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardHeader } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";

interface SettingSection { id: string; label: string; icon: React.ReactNode }

const sections: SettingSection[] = [
  { id: "store",     label: "المتجر",              icon: <Store size={15} /> },
  { id: "company",   label: "بيانات الشركة",       icon: <Building2 size={15} /> },
  { id: "print",     label: "إعدادات الطباعة",     icon: <Printer size={15} /> },
  { id: "inventory", label: "إعدادات المخزون",     icon: <Package size={15} /> },
  { id: "sales",     label: "تحليل المبيعات",      icon: <BarChart2 size={15} /> },
  { id: "orders",    label: "إعدادات الطلبات",     icon: <ShoppingBag size={15} /> },
  { id: "shipping",  label: "الشحن",               icon: <Truck size={15} /> },
  { id: "shopify",   label: "Shopify",              icon: <ShoppingBag size={15} /> },
  { id: "whatsapp",  label: "WhatsApp",             icon: <MessageSquare size={15} /> },
  { id: "notif",     label: "الإشعارات",            icon: <Bell size={15} /> },
  { id: "security",  label: "الأمان والصلاحيات",   icon: <Shield size={15} /> },
];

function Toggle({ defaultChecked = false, onChange }: { defaultChecked?: boolean; onChange?: (v: boolean) => void }) {
  const [on, setOn] = useState(defaultChecked);
  return (
    <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
      <input type="checkbox" className="sr-only peer" checked={on}
        onChange={(e) => { setOn(e.target.checked); onChange?.(e.target.checked); }} />
      <div className="w-10 h-5 bg-[var(--border-color)] peer-checked:bg-[var(--primary)] rounded-full peer transition-colors" />
      <div className="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-[-20px]" />
    </label>
  );
}

function Row({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 p-4 bg-[var(--bg-base)] rounded-[var(--radius-lg)]">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--text-primary)]">{label}</p>
        {desc && <p className="text-xs text-[var(--text-muted)] mt-0.5">{desc}</p>}
      </div>
      {children}
    </div>
  );
}

function IntegrationPlaceholder({ title, description, phase }: { title: string; description: string; phase: string }) {
  return (
    <div className="border-2 border-dashed border-[var(--border-color)] rounded-[var(--radius-lg)] p-8 text-center">
      <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">{title}</p>
      <p className="text-xs text-[var(--text-muted)] max-w-xs mx-auto">{description}</p>
      <div className="mt-4 inline-flex items-center gap-1.5 bg-[var(--warning-light)] border border-[var(--warning-border)] text-[var(--warning-text)] text-xs font-medium px-3 py-1.5 rounded-full">
        {phase}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [active, setActive] = useState("store");
  const { success } = useToast();

  // ── Store ──
  const [storeName,  setStoreName]  = useState("متجر Xeno");
  const [storeEmail, setStoreEmail] = useState("info@xeno.com");
  const [storePhone, setStorePhone] = useState("01031037293");

  // ── Company ──
  const [compPhone,   setCompPhone]   = useState("01031037293");
  const [compPhone2,  setCompPhone2]  = useState("01070717858");
  const [compAddress, setCompAddress] = useState("المحلة الكبرى");
  const [compHotline, setCompHotline] = useState("01031037293");
  const [compWa,      setCompWa]      = useState("01031037293");

  // ── Print ──
  const [barcodeW,  setBarcodeW]  = useState("36");
  const [barcodeH,  setBarcodeH]  = useState("25");
  const [labelW,    setLabelW]    = useState("80");
  const [labelH,    setLabelH]    = useState("130");

  // ── Inventory ──
  const [stockAlert, setStockAlert] = useState("25");
  const [syncStore,  setSyncStore]  = useState(true);

  // ── Sales ──
  const [fastSell,  setFastSell]  = useState("100");
  const [midSell,   setMidSell]   = useState("50");
  const [salesDays, setSalesDays] = useState("3");

  function save() { success("تم الحفظ", "تم حفظ الإعدادات بنجاح"); }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-page-title">الإعدادات</h1>
        <p className="text-small mt-0.5">تخصيص إعدادات النظام</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">

        {/* Sidebar */}
        <div className="card p-2 h-fit lg:sticky lg:top-4">
          <nav className="space-y-0.5">
            {sections.map((s) => (
              <button key={s.id} onClick={() => setActive(s.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-[var(--radius-md)] text-sm font-medium transition-all text-right ${
                  active === s.id
                    ? "bg-[var(--primary-light)] text-[var(--primary)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-base)]"
                }`}
              >
                <span className="opacity-70">{s.icon}</span>
                <span>{s.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="lg:col-span-3 space-y-4">

          {/* ── Store ── */}
          {active === "store" && (
            <Card>
              <CardHeader title="إعدادات المتجر" subtitle="المعلومات الأساسية للمتجر"
                action={<Button variant="primary" size="sm" icon={<Save size={13} />} onClick={save}>حفظ</Button>}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="اسم المتجر"          value={storeName}  onChange={(e) => setStoreName(e.target.value)}  placeholder="اسم المتجر" />
                <Input label="البريد الإلكتروني"   type="email" value={storeEmail} onChange={(e) => setStoreEmail(e.target.value)} />
                <Input label="رقم الهاتف"           type="tel"   value={storePhone} onChange={(e) => setStorePhone(e.target.value)} />
                <Input label="الموقع الإلكتروني"   defaultValue="https://xeno.com" />
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">العملة</label>
                  <select className="form-input">
                    <option value="EGP">جنيه مصري (ج.م)</option>
                    <option value="USD">دولار أمريكي ($)</option>
                  </select>
                </div>
              </div>
            </Card>
          )}

          {/* ── Company ── */}
          {active === "company" && (
            <Card>
              <CardHeader title="بيانات الشركة" subtitle="معلومات الشركة والتواصل"
                action={<Button variant="primary" size="sm" icon={<Save size={13} />} onClick={save}>حفظ</Button>}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Company Phone"        type="tel" value={compPhone}   onChange={(e) => setCompPhone(e.target.value)} />
                <Input label="Company Second Phone" type="tel" value={compPhone2}  onChange={(e) => setCompPhone2(e.target.value)} />
                <Input label="Company Hotline"      type="tel" value={compHotline} onChange={(e) => setCompHotline(e.target.value)} />
                <Input label="Company Whatsapp"     type="tel" value={compWa}      onChange={(e) => setCompWa(e.target.value)} />
                <div className="sm:col-span-2">
                  <Input label="Company Address" value={compAddress} onChange={(e) => setCompAddress(e.target.value)} />
                </div>
              </div>
            </Card>
          )}

          {/* ── Print ── */}
          {active === "print" && (
            <div className="space-y-4">
              <Card>
                <CardHeader title="إعدادات طباعة الباركود" subtitle="أبعاد ملصق الباركود (مم)" />
                <div className="grid grid-cols-2 gap-4">
                  <Input label="العرض (مم)"     type="number" value={barcodeW} onChange={(e) => setBarcodeW(e.target.value)} />
                  <Input label="الارتفاع (مم)"  type="number" value={barcodeH} onChange={(e) => setBarcodeH(e.target.value)} />
                </div>
                {/* Preview */}
                <div className="mt-4 p-3 bg-[var(--bg-base)] rounded-[var(--radius-md)] flex items-center justify-center">
                  <div
                    className="border-2 border-dashed border-[var(--border-color)] flex items-center justify-center"
                    style={{ width: `${Number(barcodeW) * 2}px`, height: `${Number(barcodeH) * 2}px`, maxWidth: "100%" }}
                  >
                    <p className="text-[10px] text-[var(--text-muted)] text-center">
                      {barcodeW}×{barcodeH} مم
                    </p>
                  </div>
                </div>
              </Card>

              <Card>
                <CardHeader title="إعدادات طباعة بوليصة الشحن" subtitle="أبعاد ملصق البوليصة (مم)"
                  action={<Button variant="primary" size="sm" icon={<Save size={13} />} onClick={save}>حفظ</Button>}
                />
                <div className="grid grid-cols-2 gap-4">
                  <Input label="العرض (مم)"     type="number" value={labelW} onChange={(e) => setLabelW(e.target.value)} />
                  <Input label="الارتفاع (مم)"  type="number" value={labelH} onChange={(e) => setLabelH(e.target.value)} />
                </div>
                <div className="mt-4 p-3 bg-[var(--bg-base)] rounded-[var(--radius-md)] flex items-center justify-center">
                  <div
                    className="border-2 border-dashed border-[var(--border-color)] flex items-center justify-center"
                    style={{ width: `${Number(labelW) * 1.5}px`, height: `${Number(labelH) * 1.5}px`, maxWidth: "100%" }}
                  >
                    <p className="text-[10px] text-[var(--text-muted)] text-center">
                      {labelW}×{labelH} مم
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* ── Inventory ── */}
          {active === "inventory" && (
            <Card>
              <CardHeader title="إعدادات المخزون" subtitle="تنبيهات والمزامنة"
                action={<Button variant="primary" size="sm" icon={<Save size={13} />} onClick={save}>حفظ</Button>}
              />
              <div className="space-y-3">
                <Row label="Stock Alert Threshold" desc="تنبيه عند وصول المخزون لهذا العدد">
                  <Input type="number" value={stockAlert} onChange={(e) => setStockAlert(e.target.value)} className="w-24 text-center" />
                </Row>
                <Row label="مزامنة الكميات مع المتجر الإلكتروني" desc="تحديث المخزون على Shopify تلقائياً عند كل معاملة">
                  <Toggle defaultChecked={syncStore} onChange={setSyncStore} />
                </Row>
              </div>
            </Card>
          )}

          {/* ── Sales ── */}
          {active === "sales" && (
            <Card>
              <CardHeader title="تحليل حركة المبيعات" subtitle="معايير تصنيف المنتجات"
                action={<Button variant="primary" size="sm" icon={<Save size={13} />} onClick={save}>حفظ</Button>}
              />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Input label="حد البيع السريع"   type="number" value={fastSell}  onChange={(e) => setFastSell(e.target.value)}  />
                <Input label="حد البيع المتوسط"  type="number" value={midSell}   onChange={(e) => setMidSell(e.target.value)}   />
                <Input label="أيام قياس المبيعات" type="number" value={salesDays} onChange={(e) => setSalesDays(e.target.value)} />
              </div>
              <div className="mt-4 p-4 bg-[var(--bg-base)] rounded-[var(--radius-lg)] text-xs text-[var(--text-muted)] space-y-1">
                <p>منتج <strong className="text-[var(--success)]">سريع البيع</strong>: بيع أكثر من {fastSell} وحدة في {salesDays} أيام</p>
                <p>منتج <strong className="text-[var(--warning)]">متوسط البيع</strong>: بيع بين {midSell} و {fastSell} وحدة في {salesDays} أيام</p>
                <p>منتج <strong className="text-[var(--danger)]">بطيء البيع</strong>: أقل من {midSell} وحدة في {salesDays} أيام</p>
              </div>
            </Card>
          )}

          {/* ── Orders ── */}
          {active === "orders" && (
            <Card>
              <CardHeader title="إعدادات الطلبات" subtitle="معالجة وتدفق الطلبات"
                action={<Button variant="primary" size="sm" icon={<Save size={13} />} onClick={save}>حفظ</Button>}
              />
              <div className="space-y-3">
                <Row label="التأكيد التلقائي" desc="تأكيد الطلبات المدفوعة تلقائياً عبر Shopify Webhook">
                  <Toggle defaultChecked />
                </Row>
                <Row label="إشعار العميل عند التحديث" desc="إرسال رسالة واتساب عند تغيير حالة الطلب">
                  <Toggle defaultChecked />
                </Row>
                <Row label="طباعة البوليصة عند الإرسال" desc="توليد بوليصة الشحن تلقائياً عند إرسال الطلب للشحن">
                  <Toggle />
                </Row>
              </div>
            </Card>
          )}

          {/* ── Shipping ── */}
          {active === "shipping" && (
            <Card>
              <CardHeader title="إعدادات الشحن" />
              <IntegrationPlaceholder
                title="ربط شركة الشحن"
                description="J&T Express · Bosta · Aramex — سيتم الربط في المرحلة الثانية"
                phase="المرحلة الثانية"
              />
              <div className="mt-5 pt-5 border-t border-[var(--border-subtle)]">
                <div className="grid grid-cols-2 gap-4">
                  <Input label="تكلفة الشحن الافتراضية" defaultValue="75" type="number" />
                  <Input label="الحد الأدنى للشحن المجاني" defaultValue="500" type="number" />
                </div>
                <div className="mt-4">
                  <Button variant="secondary" size="sm" icon={<Save size={13} />} onClick={save}>حفظ</Button>
                </div>
              </div>
            </Card>
          )}

          {/* ── Shopify ── */}
          {active === "shopify" && (
            <Card>
              <CardHeader title="إعدادات Shopify" subtitle="ربط المتجر بـ Shopify" />
              <IntegrationPlaceholder
                title="ربط Shopify"
                description="بعد الربط: المنتجات والعملاء والطلبات تأتي تلقائياً من Shopify Webhooks"
                phase="المرحلة الثانية"
              />
            </Card>
          )}

          {/* ── WhatsApp ── */}
          {active === "whatsapp" && (
            <Card>
              <CardHeader title="إعدادات WhatsApp" subtitle="WhatsApp Business API" />
              <IntegrationPlaceholder
                title="ربط WhatsApp Business API"
                description="رسائل تأكيد الطلب وتحديث الشحنة تُرسل تلقائياً للعميل عند الربط"
                phase="المرحلة الثانية"
              />
            </Card>
          )}

          {/* ── Notifications ── */}
          {active === "notif" && (
            <Card>
              <CardHeader title="الإشعارات"
                action={<Button variant="primary" size="sm" icon={<Save size={13} />} onClick={save}>حفظ</Button>}
              />
              <div className="space-y-2">
                {[
                  { label: "طلبات جديدة",    desc: "إشعار عند وصول طلب جديد من Shopify",          on: true  },
                  { label: "تحديث الطلبات",  desc: "إشعار عند تغيير حالة الطلب",                  on: true  },
                  { label: "مخزون منخفض",    desc: "إشعار عند انخفاض مستوى المخزون",              on: true  },
                  { label: "نفاد المخزون",   desc: "إشعار عند نفاد مخزون منتج",                   on: true  },
                  { label: "تحديث الشحنات",  desc: "إشعار عند تحديث حالة الشحنة",                 on: false },
                  { label: "تقارير أسبوعية", desc: "إرسال تقرير أسبوعي على البريد الإلكتروني",    on: false },
                ].map((item) => (
                  <Row key={item.label} label={item.label} desc={item.desc}>
                    <Toggle defaultChecked={item.on} />
                  </Row>
                ))}
              </div>
            </Card>
          )}

          {/* ── Security ── */}
          {active === "security" && (
            <Card>
              <CardHeader title="الأمان" subtitle="تغيير كلمة المرور" />
              <div className="space-y-4">
                <Input label="كلمة المرور الحالية" type="password" placeholder="••••••••" />
                <Input label="كلمة المرور الجديدة" type="password" placeholder="••••••••" />
                <Input label="تأكيد كلمة المرور"   type="password" placeholder="••••••••" />
              </div>
              <div className="mt-5 pt-5 border-t border-[var(--border-subtle)]">
                <Button variant="primary" size="sm" onClick={save}>تغيير كلمة المرور</Button>
              </div>
            </Card>
          )}

        </div>
      </div>
    </div>
  );
}
