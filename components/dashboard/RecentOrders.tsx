import React from "react";
import Link from "next/link";
import { Eye, ExternalLink } from "lucide-react";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/orders/OrderStatusBadge";
import { mockOrders } from "@/lib/mock/orders";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function RecentOrders() {
  const recentOrders = mockOrders.slice(0, 7);

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-section-title">أحدث الطلبات</h2>
          <p className="text-small mt-0.5">آخر الطلبات المستلمة</p>
        </div>
        <Link
          href="/dashboard/orders"
          className="text-xs text-[var(--primary)] font-medium flex items-center gap-1 hover:underline"
        >
          عرض الكل
          <ExternalLink size={12} />
        </Link>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>رقم الطلب</th>
              <th>العميل</th>
              <th>المنتجات</th>
              <th>الإجمالي</th>
              <th>الدفع</th>
              <th>الحالة</th>
              <th>التاريخ</th>
              <th className="text-center">إجراء</th>
            </tr>
          </thead>
          <tbody>
            {recentOrders.map((order) => (
              <tr key={order.id}>
                <td>
                  <span className="font-mono text-[var(--primary)] font-semibold text-xs">
                    {order.orderNumber}
                  </span>
                </td>
                <td>
                  <div>
                    <p className="font-medium text-[var(--text-primary)] text-xs">
                      {order.customerName}
                    </p>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      {order.customerPhone}
                    </p>
                  </div>
                </td>
                <td>
                  <span className="text-[var(--text-muted)] text-xs">
                    {order.items.length} منتج
                  </span>
                </td>
                <td>
                  <span className="font-semibold text-[var(--text-primary)] text-xs whitespace-nowrap">
                    {order.total.toLocaleString("en-US")} ج.م
                  </span>
                </td>
                <td>
                  <PaymentStatusBadge status={order.paymentStatus} size="sm" />
                </td>
                <td>
                  <OrderStatusBadge status={order.status} size="sm" />
                </td>
                <td>
                  <span className="text-[11px] text-[var(--text-muted)]">
                    {formatDate(order.createdAt)}
                  </span>
                </td>
                <td className="text-center">
                  <Link
                    href={`/dashboard/orders/${order.id}`}
                    className="p-1.5 rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:bg-[var(--bg-base)] hover:text-[var(--primary)] transition-colors inline-flex"
                    aria-label={`عرض الطلب ${order.orderNumber}`}
                  >
                    <Eye size={15} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
