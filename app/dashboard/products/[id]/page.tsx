import React from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Package, Tag, TrendingUp } from "lucide-react";
import { getShopifyProduct } from "@/lib/shopify/products";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

interface ProductPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = await params;
  const product = await getShopifyProduct(id);
  if (!product) notFound();

  const stockColor = product.status === "out_of_stock" ? "var(--danger)"
    : product.status === "low_stock"   ? "var(--warning)"
    : "var(--success)";
  const stockVariant = product.status === "out_of_stock" ? "danger"
    : product.status === "low_stock"   ? "warning"
    : "success";
  const stockLabel = product.status === "out_of_stock" ? "نفد المخزون"
    : product.status === "low_stock"   ? "مخزون منخفض"
    : "متوفر";

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
              {product.image ? (
                <img src={product.image} alt={product.name}
                  className="w-32 h-32 rounded-[var(--radius-lg)] object-cover flex-shrink-0 bg-[var(--bg-base)]" />
              ) : (
                <div className="w-32 h-32 rounded-[var(--radius-lg)] bg-[var(--bg-base)] flex items-center justify-center flex-shrink-0">
                  <Package size={40} className="text-[var(--border-color)]" />
                </div>
              )}
              <div className="flex-1 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <h1 className="text-page-title">{product.name}</h1>
                  <Badge variant={stockVariant} dot>{stockLabel}</Badge>
                </div>
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

          {/* Variants */}
          {product.variants.length > 1 && (
            <Card>
              <h2 className="text-section-title mb-4">المتغيرات</h2>
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>المتغير</th>
                      <th>SKU</th>
                      <th>السعر</th>
                      <th>المخزون</th>
                    </tr>
                  </thead>
                  <tbody>
                    {product.variants.map((v) => (
                      <tr key={v.id}>
                        <td><span className="text-xs text-[var(--text-primary)]">{v.title}</span></td>
                        <td><span className="font-mono text-xs text-[var(--text-muted)]">{v.sku}</span></td>
                        <td><span className="text-xs font-semibold text-[var(--text-primary)]">{v.price.toLocaleString("ar-EG")} ج.م</span></td>
                        <td>
                          <span className={`text-xs font-bold ${v.stock === 0 ? "text-[var(--danger)]" : v.stock < 10 ? "text-[var(--warning)]" : "text-[var(--success)]"}`}>
                            {v.stock}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>

        {/* Sidebar */}
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
            </div>
          </Card>

          <Card>
            <h2 className="text-section-title mb-4">المخزون</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--text-muted)]">إجمالي المتوفر</span>
                <span className="text-xl font-bold" style={{ color: stockColor }}>{product.stock}</span>
              </div>
              <div className="progress-bar">
                <div className="progress-bar-fill" style={{
                  width: `${Math.min(100, (product.stock / 100) * 100)}%`,
                  background: stockColor,
                }} />
              </div>
              <Badge variant={stockVariant} dot>{stockLabel}</Badge>
            </div>
          </Card>

          <Card>
            <h2 className="text-section-title mb-4">معلومات إضافية</h2>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp size={14} className="text-[var(--success)]" />
                  <span className="text-xs text-[var(--text-muted)]">عدد المتغيرات</span>
                </div>
                <span className="text-sm font-bold text-[var(--text-primary)]">{product.variants.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Tag size={14} className="text-[var(--orange)]" />
                  <span className="text-xs text-[var(--text-muted)]">Shopify ID</span>
                </div>
                <span className="text-sm font-mono text-[var(--text-muted)]">{product.shopifyId}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
