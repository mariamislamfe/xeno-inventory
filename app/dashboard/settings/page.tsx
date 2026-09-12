"use client";

import React, { useState } from "react";
import {
  Save, Store, Truck, ShoppingBag, MessageSquare, Bell, Lock,
  Building2, Printer, Package, BarChart2, Shield,
  CheckCircle2, XCircle, Loader2, Wifi, RefreshCw,
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
  { id: "shipping",  label: "الشحن (J&T)",         icon: <Truck size={15} /> },
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

type ConnStatus = "idle" | "testing" | "ok" | "error";

function ConnectionCard({
  title, description, status, onTest, errorMsg,
  children,
}: {
  title: string;
  description: string;
  status: ConnStatus;
  onTest: () => void;
  errorMsg?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="border border-[var(--border-color)] rounded-[var(--radius-lg)] p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[var(--text-primary)]">{title}</p>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">{description}</p>
        </div>
        <div className="flex-shrink-0">
          {status === "ok"      && <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--success)] bg-[var(--success-light)] border border-[var(--success-border)] px-2.5 py-1 rounded-full"><CheckCircle2 size={12} />متصل</span>}
          {status === "error"   && <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--danger)] bg-[var(--danger-light)] border border-[var(--danger-border)] px-2.5 py-1 rounded-full"><XCircle size={12} />خطأ</span>}
          {status === "testing" && <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--text-muted)] bg-[var(--bg-base)] border border-[var(--border-color)] px-2.5 py-1 rounded-full"><Loader2 size={12} className="animate-spin" />جارٍ الاختبار...</span>}
          {status === "idle"    && <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--text-muted)] bg-[var(--bg-base)] border border-[var(--border-color)] px-2.5 py-1 rounded-full"><Wifi size={12} />غير مختبر</span>}
        </div>
      </div>
      {errorMsg && (
        <div className="text-xs text-[var(--danger)] bg-[var(--danger-light)] border border-[var(--danger-border)] rounded-[var(--radius-md)] p-3 font-mono break-all">
          {errorMsg}
        </div>
      )}
      {children}
      <Button variant="secondary" size="sm" icon={status === "testing" ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
        onClick={onTest} disabled={status === "testing"}>
        اختبار الاتصال
      </Button>
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

  // ── Sales ──
  const [fastSell,  setFastSell]  = useState("100");
  const [midSell,   setMidSell]   = useState("50");
  const [salesDays, setSalesDays] = useState("3");

  // ── Connection tests ──
  const [jtStatus,      setJtStatus]      = useState<ConnStatus>("idle");
  const [jtError,       setJtError]       = useState("");
  const [shopifyStatus, setShopifyStatus] = useState<ConnStatus>("idle");
  const [shopifyError,  setShopifyError]  = useState("");
  const [waStatus,      setWaStatus]      = useState<ConnStatus>("idle");
  const [waError,       setWaError]       = useState("");

  async function testShopify() {
    setShopifyStatus("testing"); setShopifyError("");
    try {
      const res = await fetch("/api/shopify/orders/count?status=any");
      const data = await res.json();
      if (res.ok && data.count != null) {
        setShopifyStatus("ok");
        success("Shopify متصل", `تم التحقق — ${data.count} طلب`);
      } else {
        throw new Error(data.error ?? "فشل");
      }
    } catch (err) {
      setShopifyStatus("error");
      setShopifyError(String(err));
    }
  }

  async function testJT() {
    setJtStatus("testing"); setJtError("");
    try {
      const res  = await fetch("/api/settings/test-jt");
      const data = await res.json();
      if (res.ok && data.ok) {
        setJtStatus("ok");
        success("J&T Express متصل", data.message ?? "الاتصال ناجح");
      } else {
        throw new Error(data.error ?? JSON.stringify(data));
      }
    } catch (err) {
      setJtStatus("error");
      setJtError(String(err));
    }
  }

  async function testWA() {
    setWaStatus("testing"); setWaError("");
    try {
      const res  = await fetch("/api/settings/test-wa");
      const data = await res.json();
      if (res.ok && data.ok) {
        setWaStatus("ok");
        success("واتساب متصل", data.message ?? "الاتصال ناجح");
      } else {
        throw new Error(data.error ?? JSON.stringify(data));
      }
    } catch (err) {
      setWaStatus("error");
      setWaError(String(err));
    }
  }

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
                <Input label="هاتف الشركة"          type="tel" value={compPhone}   onChange={(e) => setCompPhone(e.target.value)} />
                <Input label="هاتف إضافي"           type="tel" value={compPhone2}  onChange={(e) => setCompPhone2(e.target.value)} />
                <Input label="خط الدعم"             type="tel" value={compHotline} onChange={(e) => setCompHotline(e.target.value)} />
                <Input label="واتساب الشركة"        type="tel" value={compWa}      onChange={(e) => setCompWa(e.target.value)} />
                <div className="sm:col-span-2">
                  <Input label="عنوان الشركة" value={compAddress} onChange={(e) => setCompAddress(e.target.value)} />
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
                <div className="mt-4 p-3 bg-[var(--bg-base)] rounded-[var(--radius-md)] flex items-center justify-center">
                  <div className="border-2 border-dashed border-[var(--border-color)] flex items-center justify-center"
                    style={{ width: `${Number(barcodeW) * 2}px`, height: `${Number(barcodeH) * 2}px`, maxWidth: "100%" }}>
                    <p className="text-[10px] text-[var(--text-muted)] text-center">{barcodeW}×{barcodeH} مم</p>
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
                  <div className="border-2 border-dashed border-[var(--border-color)] flex items-center justify-center"
                    style={{ width: `${Number(labelW) * 1.5}px`, height: `${Number(labelH) * 1.5}px`, maxWidth: "100%" }}>
                    <p className="text-[10px] text-[var(--text-muted)] text-center">{labelW}×{labelH} مم</p>
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
                <Row label="حد تنبيه المخزون المنخفض" desc="تنبيه عند وصول المخزون لهذا العدد">
                  <Input type="number" value={stockAlert} onChange={(e) => setStockAlert(e.target.value)} className="w-24 text-center" />
                </Row>
                <Row label="مزامنة الكميات مع Shopify" desc="تحديث المخزون على Shopify تلقائياً عند كل معاملة">
                  <Toggle defaultChecked />
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
                <Input label="حد البيع السريع"    type="number" value={fastSell}  onChange={(e) => setFastSell(e.target.value)} />
                <Input label="حد البيع المتوسط"   type="number" value={midSell}   onChange={(e) => setMidSell(e.target.value)} />
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

          {/* ── Shipping (J&T) ── */}
          {active === "shipping" && (
            <div className="space-y-4">
              <Card>
                <CardHeader title="شركة الشحن — J&T Express Egypt" subtitle="الإعدادات والاختبار" />
                <div className="space-y-4">
                  <ConnectionCard
                    title="J&T Express API"
                    description="ربط النظام بـ J&T لإنشاء الشحنات وجلب أرقام التتبع تلقائياً"
                    status={jtStatus}
                    onTest={testJT}
                    errorMsg={jtError}
                  >
                    <div className="space-y-1.5 text-xs text-[var(--text-muted)]">
                      <p className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${process.env.NEXT_PUBLIC_JT_CONFIGURED === "true" ? "bg-green-500" : "bg-gray-300"}`} />
                        متغيرات البيئة: JT_BASE_URL, JT_UUID, JT_CUSTOMER_CODE, JT_PASSWORD, JT_PRIVATE_KEY, JT_API_ACCOUNT
                      </p>
                      <p className="text-[11px] opacity-70">الـ credentials محفوظة في Vercel Environment Variables فقط (لا توجد في الكود)</p>
                    </div>
                  </ConnectionCard>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">تكلفة الشحن الافتراضية (ج.م)</label>
                      <input type="number" defaultValue="75" className="form-input" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">الحد الأدنى للشحن المجاني (ج.م)</label>
                      <input type="number" defaultValue="500" className="form-input" />
                    </div>
                  </div>
                  <Button variant="secondary" size="sm" icon={<Save size={13} />} onClick={save}>حفظ</Button>
                </div>
              </Card>
            </div>
          )}

          {/* ── Shopify ── */}
          {active === "shopify" && (
            <Card>
              <CardHeader title="Shopify" subtitle="حالة الربط مع متجر Shopify" />
              <div className="space-y-4">
                <ConnectionCard
                  title="Shopify Admin API"
                  description="الطلبات والعملاء والمنتجات تُجلب مباشرة من Shopify"
                  status={shopifyStatus}
                  onTest={testShopify}
                  errorMsg={shopifyError}
                >
                  <div className="text-xs text-[var(--text-muted)] space-y-1">
                    <p>متغيرات البيئة: SHOPIFY_SHOP, SHOPIFY_ACCESS_TOKEN</p>
                    <p className="text-[11px] opacity-70">الـ webhooks: orders/create, orders/updated — مسجّلة عبر /api/webhooks/shopify</p>
                  </div>
                </ConnectionCard>
                <div className="p-4 bg-[var(--success-light)] border border-[var(--success-border)] rounded-[var(--radius-lg)]">
                  <p className="text-xs font-semibold text-[var(--success-text)] mb-2">ما هو مُفعَّل حالياً:</p>
                  <ul className="text-xs text-[var(--success-text)] space-y-1 list-disc list-inside">
                    <li>قراءة الطلبات مع كل التاجز (Vrobo + غيره)</li>
                    <li>إنشاء طلب جديد من داخل النظام</li>
                    <li>تعديل عنوان / هاتف / ملاحظات الطلب</li>
                    <li>إضافة وحذف تاجز من الطلب</li>
                    <li>قراءة العملاء والمنتجات</li>
                    <li>الربط بـ Vrobo عبر تاجز Shopify</li>
                  </ul>
                </div>
              </div>
            </Card>
          )}

          {/* ── WhatsApp ── */}
          {active === "whatsapp" && (
            <Card>
              <CardHeader title="WhatsApp" subtitle="خدمة الواتساب (Vrobo + النظام)" />
              <div className="space-y-4">

                {/* Vrobo */}
                <div className="p-4 bg-[var(--primary-light)] border border-[var(--primary-muted)] rounded-[var(--radius-lg)]">
                  <p className="text-xs font-bold text-[var(--primary)] mb-1">Vrobo — رسائل التأكيد</p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Vrobo متصل بـ Shopify ويبعت رسائل تأكيد الأوردر للعميل تلقائياً.
                    النتيجة بتسجّل على النظام عن طريق تاجز Shopify.
                  </p>
                </div>

                {/* Internal WA service */}
                <ConnectionCard
                  title="خدمة واتساب الداخلية (اختيارية)"
                  description="لإرسال رقم التتبع للعميل بعد الشحن — تحتاج Fly.io deployment"
                  status={waStatus}
                  onTest={testWA}
                  errorMsg={waError}
                >
                  <div className="text-xs text-[var(--text-muted)] space-y-1">
                    <p>متغيرات البيئة: WA_SERVICE_URL, WA_SECRET</p>
                    <p className="text-[11px] opacity-70">لو مش متصل، رقم التتبع بيتحفظ في النظام بس مش بيتبعت على واتساب تلقائي</p>
                  </div>
                </ConnectionCard>
              </div>
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
                  { label: "طلبات جديدة",    desc: "إشعار عند وصول طلب جديد من Shopify",        on: true  },
                  { label: "تحديث الطلبات",  desc: "إشعار عند تغيير حالة الطلب",                on: true  },
                  { label: "مخزون منخفض",    desc: "إشعار عند انخفاض مستوى المخزون",            on: true  },
                  { label: "نفاد المخزون",   desc: "إشعار عند نفاد مخزون منتج",                 on: true  },
                  { label: "تحديث الشحنات",  desc: "إشعار عند تحديث حالة الشحنة من J&T",       on: false },
                  { label: "تقارير أسبوعية", desc: "إرسال تقرير أسبوعي على البريد الإلكتروني", on: false },
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
                <Button variant="primary" size="sm" icon={<Lock size={13} />} onClick={save}>تغيير كلمة المرور</Button>
              </div>
            </Card>
          )}

        </div>
      </div>
    </div>
  );
}
