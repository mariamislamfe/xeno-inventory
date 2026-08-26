import React from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Phone, Mail, MapPin, ShoppingCart, TrendingUp, Calendar } from "lucide-react";
import { getCustomerById } from "@/lib/services/customers";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { OrderStatusBadge } from "@/components/orders/OrderStatusBadge";
import { mockOrders } from "@/lib/mock/orders";

interface CustomerPageProps {
  params: Promise<{ id: string }>;
}

export default async function CustomerPage({ params }: CustomerPageProps) {
  const { id } = await params;
  const customer = await getCustomerById(id);

  if (!customer) notFound();

  const orders = mockOrders.filter((o) => o.customerId === id).slice(0, 8);

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
        <Link href="/dashboard/customers" className="flex items-center gap-1.5 hover:text-[var(--primary)] transition-colors">
          <ArrowRight size={16} />
          العملاء
        </Link>
        <span>/</span>
        <span className="text-[var(--text-primary)] font-medium">{customer.name}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Customer Info */}
        <div className="space-y-5">
          <Card>
            <div className="text-center mb-4">
              <div className="w-16 h-16 rounded-full bg-[var(--primary)] flex items-center justify-center text-white text-2xl font-bold mx-auto mb-3">
                {customer.name.charAt(0)}
              </div>
              <h1 className="text-base font-bold text-[var(--text-primary)]">{customer.name}</h1>
              <Badge variant={customer.status === "active" ? "success" : "neutral"} dot className="mt-2">
                {customer.status === "active" ? "عميل نشط" : "غير نشط"}
              </Badge>
            </div>

            <div className="space-y-3 pt-3 border-t border-[var(--border-subtle)]">
              <a href={`tel:${customer.phone}`} className="flex items-center gap-2.5 text-xs text-[var(--text-secondary)] hover:text-[var(--primary)] transition-colors">
                <Phone size={14} className="text-[var(--text-muted)]" />
                {customer.phone}
              </a>
              <a href={`mailto:${customer.email}`} className="flex items-center gap-2.5 text-xs text-[var(--text-secondary)] hover:text-[var(--primary)] transition-colors">
                <Mail size={14} className="text-[var(--text-muted)]" />
                {customer.email}
              </a>
              <div className="flex items-start gap-2.5 text-xs text-[var(--text-secondary)]">
                <MapPin size={14} className="text-[var(--text-muted)] flex-shrink-0 mt-0.5" />
                <span>{customer.address}</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs text-[var(--text-secondary)]">
                <Calendar size={14} className="text-[var(--text-muted)]" />
                عميل منذ {new Date(customer.createdAt).toLocaleDateString("ar-EG", { year: "numeric", month: "long" })}
              </div>
            </div>
          </Card>

          {/* Stats */}
          <Card>
            <h2 className="text-section-title mb-4">إحصائيات</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingCart size={14} className="text-[var(--primary)]" />
                  <span className="text-xs text-[var(--text-muted)]">عدد الطلبات</span>
                </div>
                <span className="text-sm font-bold text-[var(--text-primary)]">{customer.orderCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp size={14} className="text-[var(--success)]" />
                  <span className="text-xs text-[var(--text-muted)]">إجمالي الإنفاق</span>
                </div>
                <span className="text-sm font-bold text-[var(--primary)]">
                  {customer.totalSpent.toLocaleString("ar-EG")} ج.م
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar size={14} className="text-[var(--warning)]" />
                  <span className="text-xs text-[var(--text-muted)]">متوسط قيمة الطلب</span>
                </div>
                <span className="text-sm font-bold text-[var(--text-primary)]">
                  {customer.orderCount > 0
                    ? Math.round(customer.totalSpent / customer.orderCount).toLocaleString("ar-EG")
                    : 0}{" "}
                  ج.م
                </span>
              </div>
            </div>
          </Card>
        </div>

        {/* Orders */}
        <div className="lg:col-span-2">
          <Card>
            <h2 className="text-section-title mb-4">سجل الطلبات</h2>
            {orders.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)] text-center py-8">
                لا توجد طلبات لهذا العميل
              </p>
            ) : (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>رقم الطلب</th>
                      <th>المنتجات</th>
                      <th>الإجمالي</th>
                      <th>الحالة</th>
                      <th>التاريخ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.id}>
                        <td>
                          <Link
                            href={`/dashboard/orders/${order.id}`}
                            className="font-mono text-xs text-[var(--primary)] font-semibold hover:underline"
                          >
                            {order.orderNumber}
                          </Link>
                        </td>
                        <td>
                          <span className="text-xs text-[var(--text-muted)]">
                            {order.items.length} منتج
                          </span>
                        </td>
                        <td>
                          <span className="text-xs font-semibold text-[var(--text-primary)]">
                            {order.total.toLocaleString("ar-EG")} ج.م
                          </span>
                        </td>
                        <td>
                          <OrderStatusBadge status={order.status} size="sm" />
                        </td>
                        <td>
                          <span className="text-[11px] text-[var(--text-muted)]">
                            {new Date(order.createdAt).toLocaleDateString("ar-EG")}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
