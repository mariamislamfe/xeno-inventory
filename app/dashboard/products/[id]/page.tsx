import React from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Package,
  Tag,
  TrendingUp,
  ShoppingCart,
} from "lucide-react";
import { getProductById } from "@/lib/services/products";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { mockOrders } from "@/lib/mock/orders";

interface ProductPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = await params;
  const product = await getProductById(id);

  if (!product) notFound();

  const recentOrders = mockOrders.filter((o) =>
    o.items.some((i) => i.productId === product.id)
  ).slice(0, 5);

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
        <Link href="/dashboard/products" className="flex items-center gap-1.5 hover:text-[var(--primary)] transition-colors">
          <ArrowRight size={16} />
          المنتجات
        </Link>
        <span>/</span>
        <span className="text-[var(--text-primary)] font-medium">{product.name}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Product Info */}
        <div className="lg:col-span-2 space-y-5">
          <Card>
            <div className="flex gap-5">
              <div className="w-32 h-32 rounded-[var(--radius-lg)] bg-[var(--bg-base)] flex items-center justify-center flex-shrink-0">
                <Package size={40} className="text-[var(--border-color)]" />
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <h1 className="text-page-title">{product.name}</h1>
                  <Badge variant={product.status === "active" ? "success" : "neutral"}>
                    {product.status === "active" ? "نشط" : product.status === "inactive" ? "غير نشط" : "مسودة"}
                  </Badge>
                </div>
                {product.description && (
                  <p className="text-sm text-[var(--text-secondary)]">{product.description}</p>
                )}
                <div className="flex flex-wrap gap-4 pt-2">
                  <div>
                    <p className="text-[11px] text-[var(--text-muted)]">SKU</p>
                    <p className="text-xs font-mono font-bold text-[var(--text-primary)]">{product.sku}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-[var(--text-muted)]">التصنيف</p>
                    <p className="text-xs text-[var(--text-primary)]">{product.category}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-[var(--text-muted)]">تاريخ الإضافة</p>
                    <p className="text-xs text-[var(--text-primary)]">
                      {new Date(product.createdAt).toLocaleDateString("ar-EG")}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Recent Orders */}
          <Card>
            <h2 className="text-section-title mb-4">الطلبات الأخيرة</h2>
            {recentOrders.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)] text-center py-6">
                لا توجد طلبات لهذا المنتج
              </p>
            ) : (
              <div className="space-y-3">
                {recentOrders.map((order) => {
                  const item = order.items.find((i) => i.productId === product.id);
                  return (
                    <div key={order.id} className="flex items-center justify-between gap-4 py-2 border-b border-[var(--border-subtle)] last:border-0">
                      <div>
                        <Link href={`/dashboard/orders/${order.id}`} className="text-xs font-mono text-[var(--primary)] hover:underline">
                          {order.orderNumber}
                        </Link>
                        <p className="text-[11px] text-[var(--text-muted)]">{order.customerName}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs font-medium text-[var(--text-primary)]">
                          × {item?.quantity}
                        </p>
                      </div>
                      <p className="text-xs font-semibold text-[var(--text-primary)]">
                        {item?.total.toLocaleString("ar-EG")} ج.م
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-5">
          <Card>
            <h2 className="text-section-title mb-4">التسعير</h2>
            <div className="space-y-3">
              <div>
                <p className="text-[11px] text-[var(--text-muted)]">السعر الحالي</p>
                <p className="text-2xl font-bold text-[var(--text-primary)]">
                  {product.price.toLocaleString("ar-EG")} <span className="text-sm font-normal text-[var(--text-muted)]">ج.م</span>
                </p>
              </div>
              {product.comparePrice && (
                <div>
                  <p className="text-[11px] text-[var(--text-muted)]">السعر الأصلي</p>
                  <p className="text-sm text-[var(--text-muted)] line-through">
                    {product.comparePrice.toLocaleString("ar-EG")} ج.م
                  </p>
                  <Badge variant="danger" size="sm" className="mt-1">
                    خصم {Math.round(((product.comparePrice - product.price) / product.comparePrice) * 100)}%
                  </Badge>
                </div>
              )}
            </div>
          </Card>

          <Card>
            <h2 className="text-section-title mb-4">المخزون</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--text-muted)]">المتوفر</span>
                <span className={`text-xl font-bold ${product.inventory === 0 ? "text-[var(--danger)]" : product.inventory < 10 ? "text-[var(--warning)]" : "text-[var(--success)]"}`}>
                  {product.inventory}
                </span>
              </div>
              <div className="progress-bar">
                <div
                  className="progress-bar-fill"
                  style={{
                    width: `${Math.min(100, (product.inventory / 100) * 100)}%`,
                    background: product.inventory === 0
                      ? "var(--danger)"
                      : product.inventory < 10
                      ? "var(--warning)"
                      : "var(--success)",
                  }}
                />
              </div>
              {product.inventory === 0 && (
                <Badge variant="danger" dot>نفد المخزون</Badge>
              )}
              {product.inventory > 0 && product.inventory < 10 && (
                <Badge variant="warning" dot>مخزون منخفض</Badge>
              )}
              {product.inventory >= 10 && (
                <Badge variant="success" dot>متوفر</Badge>
              )}
            </div>
          </Card>

          <Card>
            <h2 className="text-section-title mb-4">إحصائيات المبيعات</h2>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp size={14} className="text-[var(--success)]" />
                  <span className="text-xs text-[var(--text-muted)]">إجمالي المبيعات</span>
                </div>
                <span className="text-sm font-bold text-[var(--text-primary)]">{product.totalSales}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingCart size={14} className="text-[var(--primary)]" />
                  <span className="text-xs text-[var(--text-muted)]">الإيراد الإجمالي</span>
                </div>
                <span className="text-sm font-bold text-[var(--primary)]">
                  {(product.totalSales * product.price).toLocaleString("ar-EG")} ج.م
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Tag size={14} className="text-[var(--orange)]" />
                  <span className="text-xs text-[var(--text-muted)]">الطلبات المرتبطة</span>
                </div>
                <span className="text-sm font-bold text-[var(--text-primary)]">{recentOrders.length}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
