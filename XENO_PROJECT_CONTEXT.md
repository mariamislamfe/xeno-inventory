# XENO — ملف السياق الكامل للمشروع
> أعطِ هذا الملف لـ Claude في أي جهاز لتكمل من حيث توقفنا بالضبط.

---

## 1. ما هو المشروع؟

**XENO** — نظام إدارة مخزون وطلبات مبني بـ Next.js لشركة ملابس مصرية (كان اسمه COTMASR).
- الواجهة عربية RTL بالكامل
- الشركة المنفذة: **Websity** (`websity.dev@gmail.com`)
- الريبو على GitHub: `https://github.com/mariamislamfe/xeno-inventory.git`
- مسار المشروع على الجهاز القديم: `c:/Users/IslamIbrahimAbdElNab/Desktop/hany/cotmasr`

---

## 2. Stack التقني

| الحاجة | التفاصيل |
|---|---|
| Framework | Next.js 16.3.1 (App Router + Turbopack) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 — يستخدم `@import "tailwindcss"` مش `@tailwind base` |
| UI | lucide-react, recharts |
| Fonts | Cairo (عربي) + Inter (أرقام) — محملين كـ CSS variables |
| State | React useState فقط (لا Redux، لا Zustand) |
| Data | Mock data فقط — Phase 2 هتضاف Supabase |

### ملاحظات مهمة جداً
- Tailwind v4: `@import "tailwindcss"` و `@theme inline {}` — **مش** `@tailwind base/components/utilities`
- Next.js 16: `params` و `searchParams` هما **Promises** → لازم `await params`
- Dark mode: عن طريق `data-theme="dark"` على `<html>`
- الأرقام الإنجليزية في سياق RTL: لازم `dir="ltr"` على العنصر عشان K/M تبقى على اليمين

---

## 3. الثيم والألوان

**Light mode:** خلفية بيضاء، صفحة رمادي فاتح (#f5f5f5)، سايدبار أسود (#0c0c0c)
**Dark mode:** خلفية سوداء (#050505)، كروت (#111111)، سايدبار أسود تام (#000000)
**Primary color:** أحمر — `#dc2626` (light) / `#ef4444` (dark)
**Sidebar active:** أحمر — `rgba(220,38,38,0.1)` background + `#ef4444` text
**Active في السايدبار ≠ أخضر** (كان أخضر في البداية، اتغير لأحمر)

### CSS Variables الأساسية (من globals.css)
```css
/* Light */
--bg-base: #f5f5f5
--bg-card: #ffffff
--bg-sidebar: #0c0c0c
--primary: #dc2626
--primary-hover: #b91c1c
--primary-light: #fff1f2

/* Dark */
--bg-base: #050505
--bg-card: #111111
--primary: #ef4444
```

### Classes مخصصة
- `.text-stat` — 2.25rem/900wt/Inter (أرقام KPI كبيرة)
- `.text-stat-md` — 1.5rem/800wt
- `.text-page-title` — 1.625rem/900wt
- `.text-section-title` — 0.9375rem/800wt
- `.form-input`, `.btn-primary`, `.btn-secondary`, `.card`, `.data-table`

---

## 4. هيكل الملفات

```
cotmasr/
├── app/
│   ├── layout.tsx                    ← Cairo+Inter fonts, ThemeProvider, lang="ar" dir="rtl"
│   ├── globals.css                   ← كل الـ CSS variables والثيم
│   ├── page.tsx                      ← redirect to /dashboard
│   ├── dashboard/
│   │   ├── layout.tsx                ← Sidebar + Header + main content
│   │   ├── page.tsx                  ← لوحة التحكم الرئيسية
│   │   ├── orders/
│   │   │   ├── page.tsx              ← جدول الطلبات مع filter tabs
│   │   │   └── [id]/
│   │   │       ├── page.tsx          ← تفاصيل الطلب
│   │   │       ├── OrderDetailsClient.tsx
│   │   │       └── label/
│   │   │           ├── page.tsx      ← server component
│   │   │           └── PrintLabelClient.tsx ← بوليصة الشحن القابلة للطباعة
│   │   ├── products/
│   │   │   ├── page.tsx              ← grid المنتجات + import buttons
│   │   │   └── [id]/page.tsx
│   │   ├── customers/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── inventory/page.tsx
│   │   ├── shipments/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── transactions/page.tsx     ← NEW — معاملات المخزون
│   │   ├── activity/page.tsx         ← NEW — سجل النشاط
│   │   ├── reports/page.tsx
│   │   ├── users/page.tsx            ← إدارة المستخدمين + الأدوار + الصلاحيات
│   │   └── settings/page.tsx         ← إعدادات موسعة
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx               ← Nav مع groups، "Made by Websity" في الأسفل
│   │   ├── Header.tsx                ← إشعارات (نقاط ملونة مش emoji)، dark mode toggle
│   │   └── MobileSidebar.tsx
│   ├── dashboard/
│   │   ├── StatsCard.tsx             ← KPI card بدون أيقونة، رقم كبير
│   │   ├── InventoryAlertCard.tsx    ← بطاقة تنبيه قابلة للتوسيع
│   │   ├── InventoryLevelChart.tsx   ← Bar chart (Recharts) لمستويات المخزون
│   │   ├── RecentTransactions.tsx    ← آخر المعاملات
│   │   ├── QuickTransaction.tsx      ← معاملة سريعة widget
│   │   ├── SalesChart.tsx
│   │   └── OrdersChart.tsx
│   ├── orders/OrderStatusBadge.tsx
│   ├── providers/ThemeProvider.tsx   ← localStorage + data-theme على html
│   └── ui/
│       ├── Badge.tsx, Button.tsx, Card.tsx
│       ├── Input.tsx (+ SearchInput export)
│       ├── Modal.tsx  ← prop: open (مش isOpen!)
│       ├── Toast.tsx  ← useToast() hook
│       ├── Pagination.tsx, Skeleton.tsx, EmptyState.tsx
├── lib/
│   ├── types/index.ts                ← كل الـ TypeScript types
│   ├── mock/
│   │   ├── orders.ts                 ← 3 طلبات حقيقية (هاني حلمي، ملابس)
│   │   ├── products.ts
│   │   ├── customers.ts
│   │   ├── inventory.ts              ← 14 منتج ملابس (بنطالين/تيشيرتات/فساتين/جاكيتات/شورتات)
│   │   ├── inventory-stats.ts        ← totalValue: 734400، totalSkus: 14
│   │   ├── transactions.ts           ← NEW — 5 معاملات (3 وارد، 2 صادر)
│   │   ├── notifications.ts          ← 6 إشعارات بمنتجات حقيقية
│   │   ├── shipments.ts, reports.ts
│   │   └── users.ts                 ← 2 مستخدمين: admin + inventory_manager
│   └── services/
│       ├── inventory.ts              ← getProductStockLevels(), getOutOfStockItems(), etc.
│       ├── orders.ts, products.ts, customers.ts, shipments.ts, whatsapp.ts
```

---

## 5. Types المهمة (lib/types/index.ts)

```typescript
// الطلب
type WhatsAppStatus = "not_sent" | "sent" | "seen" | "confirmed"
interface Order {
  // ...
  whatsappStatus?: WhatsAppStatus
  autoTrackingNumber?: string
  printLabelReady?: boolean
}

// المخزون
type TransactionType = "in" | "out"
interface InventoryTransaction {
  id, type, sku, productName, category, quantity, note?, createdAt, createdBy
}

// المستخدمون
type UserRole = "admin" | "inventory_manager" | "staff"
type UserStatus = "active" | "inactive"
interface User { id, name, email, role, status, lastLogin, createdAt }
```

---

## 6. Pages المنجزة بالتفصيل

### /dashboard (لوحة التحكم)
- 3 KPI cards: قيمة المخزون / التكلفة / عدد الـ SKUs
- 2 تنبيه cards: أصناف نفذت (out of stock) + منخفضة المخزون
- Bar chart: مستويات المخزون بالمنتج الحقيقي (ألوان: أزرق=متوفر، أصفر=منخفض، أحمر=نفد)
- Grid 2×2: آخر المعاملات + تنبيهات المخزون + معاملة سريعة + آخر الإشعارات
- `fmt(n)` function: بتحول الأرقام → `"734.4 K"` أو `"8.28 M"`

### /dashboard/orders (الطلبات)
- Filter tabs: الكل / مكتملة / مرتجعة / ملغية / مطبوعة / غير مطبوعة
- أعمدة: رقم الطلب / العميل / المنتجات (مع variant) / الإجمالي / الحالة / الدفع / واتساب / رقم التتبع / التاريخ / إجراءات
- WhatsApp status: ✓✓ أخضر (confirmed) / ✓✓ أزرق (seen) / ✓ رمادي (sent)
- زر طباعة البوليصة (Printer icon أخضر) بيظهر لما `printLabelReady === true`

### /dashboard/orders/[id]/label (البوليصة)
- طباعة على ورق 80×130mm
- Header أسود (#0f172b) مع XENO + اسم شركة الشحن
- SVG barcode من رقم التتبع
- بيانات العميل + المنتجات + الإجمالي
- تطبع أوتوماتيك بعد 600ms من الفتح
- `@page { size: 80mm 130mm; margin: 0; }`

### /dashboard/settings (الإعدادات)
أقسام: بيانات المتجر / بيانات الشركة / إعدادات الطباعة / إعدادات المخزون / تحليل المبيعات / الطلبات / الشحن / Shopify / WhatsApp / الإشعارات / الأمان

- **إعدادات الطباعة**: barcode 36×25mm، label 80×130mm مع preview حجم حقيقي
- **إعدادات المخزون**: حد تنبيه المخزون (25 وحدة)، toggle مزامنة
- **تحليل المبيعات**: سريع الحركة ≥100 / متوسط ≥50 / عدد أيام التحليل 3

### /dashboard/products (المنتجات)
- زر "استيراد منتجات Shopify" + زر "استيراد منتجات إيزي أوردر"
- كلاهما بيعرض alert "سيتم الربط في المرحلة الثانية"

### /dashboard/transactions (المعاملات) — جديد
- Filter tabs: الكل / وارد / صادر مع counts
- جدول: المعرف / النوع (badge بسهم) / المنتج / SKU / القسم / الكمية (+ أخضر / − أحمر) / السبب / المستخدم / التاريخ

### /dashboard/activity (سجل النشاط) — جديد
- Timeline يجمع transactions + notifications مرتبة بالتاريخ
- فلتر بالنوع + بحث
- Pagination

### /dashboard/users (المستخدمون) — جديد ومكتمل
- **Tab "المستخدمون"**: جدول + Edit button شغال فعلاً
- **Edit User Modal**: اسم / email / دور (مع preview صلاحيات الدور) / حالة
- **Tab "الأدوار والصلاحيات"**: عرض الأدوار الثلاثة مع permission matrix
- **Edit Role Modal**: checkbox per permission، toggle-all per group، color picker
- الأدوار: مدير (كل الصلاحيات) / مدير مخزون / موظف
- الصلاحيات: dashboard.view / orders.view/edit/delete / products / inventory / transactions / shipments / reports / users.manage / settings.manage / activity.view

---

## 7. Mock Data الحقيقي

### المنتجات/المخزون
```
SKU       | الاسم              | الكمية | الحالة
BNT-0016  | بنطلون كلاسيك     | 35     | in_stock
BNT-0017  | بنطلون جينز        | 28     | in_stock
BNT-0018  | بنطلون كتان        | 0      | out_of_stock ❌
BNT-0019  | بنطلون بضبع        | 8      | low_stock ⚠️
TSH-0007  | تيشيرت أوفرسايز    | 42     | in_stock
TSH-0008  | تيشيرت بولو        | 31     | in_stock
TSH-0009  | تيشيرت كروب        | 0      | out_of_stock ❌
TSH-0010  | تيشيرت رياضي       | 12     | low_stock ⚠️
FST-0003  | فستان صيفي          | 22     | in_stock
FST-0004  | فستان سهرة          | 4      | low_stock ⚠️
JAK-0001  | جاكيت جلد           | 18     | in_stock
JAK-0002  | جاكيت كاجوال        | 0      | out_of_stock ❌
SHR-0001  | شورت رياضي          | 55     | in_stock
SHR-0002  | شورت بيتش           | 6      | low_stock ⚠️
```

### الطلبات
- ord-001: هاني حلمي، 01111617471، الغربية — whatsappStatus: "sent"
- ord-002: هاني حلمي — autoTrackingNumber: "JEG000519960057", whatsappStatus: "confirmed", printLabelReady: true
- ord-003: هاني حلمي — whatsappStatus: "not_sent"

### المستخدمون
- user-001: محمد الإداري / admin@xeno.com / admin
- user-002: مدير المخزون / inventory@xeno.com / inventory_manager

---

## 8. Sidebar Navigation

```
الرئيسية
  - لوحة التحكم (/dashboard)

المبيعات
  - الطلبات (/dashboard/orders)
  - العملاء (/dashboard/customers)
  - الشحنات (/dashboard/shipments)

المخزون
  - المنتجات (/dashboard/products)
  - إدارة المخزون (/dashboard/inventory)
  - المعاملات (/dashboard/transactions)  ← جديد

النظام
  - التقارير (/dashboard/reports)
  - المستخدمون (/dashboard/users)
  - سجل النشاط (/dashboard/activity)  ← جديد
  - الإعدادات (/dashboard/settings)

Footer: Made by Websity (Websity بلون var(--primary) الأحمر)
```

---

## 9. تفاصيل مهمة تقنية

### Modal Component
```tsx
// الصح:
<Modal open onClose={onClose} title="..." size="md">
// الغلط (مش هيشتغل):
<Modal isOpen onClose={onClose} ...>
```

### أرقام في RTL
```tsx
// الصح — K على اليمين:
<p dir="ltr">734.4 K</p>
// الغلط — K على الشمال:
<p>734.4 K</p>
```

### Recharts في RTL
```css
.recharts-wrapper { direction: ltr; }
```

### ThemeProvider
```tsx
// في layout.tsx
<ThemeProvider>
  <html lang="ar" dir="rtl" suppressHydrationWarning>
```

### Dark mode toggle
ThemeProvider بيحط `data-theme="dark"` أو `data-theme="light"` على `document.documentElement`

---

## 10. الخطوات الجاية (Phase 2) — لسه ما اتعملتش

| الخطوة | التفاصيل |
|---|---|
| Supabase | ربط قاعدة البيانات — تبديل mock data بـ real queries |
| Shopify | sync المنتجات والعملاء والطلبات |
| WhatsApp API | إرسال رسائل تلقائية للعملاء |
| شركة الشحن | J&T أو Aramex — توليد tracking numbers |
| Auth | Supabase Auth + استخدام role system المبني |
| Inventory Sync | تحديث المخزون أوتوماتيك مع كل طلب |

**الفلو المتوقع:**
1. طلب جديد من Shopify → Webhook → ينزل في XENO
2. المخزون بيتخصم أوتوماتيك
3. رسالة WhatsApp تتبعت للعميل
4. tracking number بيتولد من شركة الشحن
5. كل ده بيظهر في /dashboard

---

## 11. أوامر تشغيل المشروع

```bash
# تشغيل محلي
npm run dev

# build للتأكد من عدم وجود أخطاء
npm run build

# الـ repo
git remote add origin https://github.com/mariamislamfe/xeno-inventory.git
git branch -M main
git push -u origin main
```

---

## 12. ما اتعمل محلياً من جهاز الـ development

آخر push كان يتضمن:
- ثيم أسود وأحمر (تغيير globals.css)
- صفحة المستخدمين مع Edit modal شغال + Roles tab
- إصلاح Modal (كان `isOpen` صار `open`)
- كل ما قبله من Phase 2 Features

---

> **ملحوظة للـ Claude الجديد:** المشروع على GitHub. كلون الريبو، وابدأ من هنا. كل حاجة مكتوبة فعلاً وشغالة عدا الـ Phase 2 (Supabase وما يليها).
