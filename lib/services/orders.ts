/**
 * Orders Service - Phase 1: Mock Data
 * Phase 2: Replace with Supabase/Shopify implementation
 */

import { mockOrders } from "../mock/orders";
import type { Order, OrderStatus, PaymentStatus, ShippingStatus } from "../types";

export interface OrderFilters {
  search?: string;
  status?: OrderStatus | "";
  paymentStatus?: PaymentStatus | "";
  shippingStatus?: ShippingStatus | "";
  dateFrom?: string;
  dateTo?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function getOrders(
  filters?: OrderFilters,
  page = 1,
  pageSize = 10
): Promise<PaginatedResult<Order>> {
  // Simulate async behavior
  await new Promise((resolve) => setTimeout(resolve, 0));

  let filtered = [...mockOrders];

  if (filters?.search) {
    const q = filters.search.toLowerCase();
    filtered = filtered.filter(
      (o) =>
        o.orderNumber.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.customerPhone.includes(q)
    );
  }

  if (filters?.status) {
    filtered = filtered.filter((o) => o.status === filters.status);
  }

  if (filters?.paymentStatus) {
    filtered = filtered.filter((o) => o.paymentStatus === filters.paymentStatus);
  }

  if (filters?.shippingStatus) {
    filtered = filtered.filter((o) => o.shippingStatus === filters.shippingStatus);
  }

  const total = filtered.length;
  const totalPages = Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize;
  const data = filtered.slice(start, start + pageSize);

  return { data, total, page, pageSize, totalPages };
}

export async function getOrderById(id: string): Promise<Order | null> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  return mockOrders.find((o) => o.id === id) ?? null;
}

export async function updateOrderStatus(
  id: string,
  status: OrderStatus
): Promise<Order | null> {
  // Phase 1: mock update
  const order = mockOrders.find((o) => o.id === id);
  if (!order) return null;
  order.status = status;
  order.updatedAt = new Date().toISOString();
  return order;
}

export async function sendToShipping(
  orderId: string
): Promise<{ success: boolean; trackingNumber: string }> {
  // Phase 1: Simulate shipping API call
  await new Promise((resolve) => setTimeout(resolve, 1500));

  const trackingNumber = `TRK-${Math.floor(100000 + Math.random() * 900000)}`;
  const order = mockOrders.find((o) => o.id === orderId);

  if (order) {
    order.status = "sent_to_shipping";
    order.shippingStatus = "shipped";
    order.trackingNumber = trackingNumber;
    order.shippingProvider = "أراماكس";
    order.updatedAt = new Date().toISOString();
  }

  return { success: true, trackingNumber };
}

export function getOrderStats() {
  const total = mockOrders.length;
  const newOrders = mockOrders.filter((o) => o.status === "new").length;
  const processing = mockOrders.filter((o) => o.status === "processing").length;
  const shipped = mockOrders.filter(
    (o) => o.status === "sent_to_shipping" || o.status === "in_delivery"
  ).length;
  const delivered = mockOrders.filter((o) => o.status === "delivered").length;

  const totalSales = mockOrders
    .filter((o) => o.paymentStatus === "paid")
    .reduce((sum, o) => sum + o.total, 0);

  return { total, newOrders, processing, shipped, delivered, totalSales };
}
