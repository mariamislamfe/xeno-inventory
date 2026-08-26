// ==========================================
// XENO INVENTORY OS - TYPE DEFINITIONS
// ==========================================

export type OrderStatus =
  | "new"
  | "reviewing"
  | "confirmed"
  | "processing"
  | "processed"
  | "sent_to_shipping"
  | "in_delivery"
  | "delivered"
  | "cancelled"
  | "returned";

export type PaymentStatus = "pending" | "paid" | "refunded" | "failed";

export type ShippingStatus =
  | "not_shipped"
  | "preparing"
  | "shipped"
  | "in_delivery"
  | "delivered"
  | "failed"
  | "returned";

export type UserRole = "admin" | "inventory_manager" | "staff";

export type UserStatus = "active" | "inactive";

export type ProductStatus = "active" | "inactive" | "draft";

export type InventoryStatus = "in_stock" | "low_stock" | "out_of_stock";

export type ShipmentStatus =
  | "preparing"
  | "shipped"
  | "in_delivery"
  | "delivered"
  | "failed"
  | "returned";

// ==========================================
// ORDER TYPES
// ==========================================

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  productImage?: string;
  sku: string;
  price: number;
  quantity: number;
  total: number;
  variant?: string;
}

export interface OrderTimeline {
  id: string;
  status: OrderStatus;
  label: string;
  timestamp: string;
  note?: string;
  completed: boolean;
}

export type WhatsAppStatus = "not_sent" | "sent" | "seen" | "confirmed";

export interface Order {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  city: string;
  governorate: string;
  address: string;
  items: OrderItem[];
  subtotal: number;
  shippingCost: number;
  discount: number;
  total: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  shippingStatus: ShippingStatus;
  trackingNumber?: string;
  shippingProvider?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  timeline: OrderTimeline[];
  // WhatsApp flow — populated on integration
  whatsappStatus?: WhatsAppStatus;
  autoTrackingNumber?: string;
  printLabelReady?: boolean;
}

// ==========================================
// PRODUCT TYPES
// ==========================================

export interface ProductVariant {
  id: string;
  name: string;
  sku: string;
  price: number;
  inventory: number;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  sku: string;
  category: string;
  price: number;
  comparePrice?: number;
  inventory: number;
  status: ProductStatus;
  images: string[];
  variants?: ProductVariant[];
  totalSales: number;
  createdAt: string;
}

// ==========================================
// CUSTOMER TYPES
// ==========================================

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  governorate: string;
  address: string;
  orderCount: number;
  totalSpent: number;
  lastOrderDate: string;
  status: "active" | "inactive";
  createdAt: string;
}

// ==========================================
// INVENTORY TYPES
// ==========================================

export interface InventoryItem {
  id: string;
  productId: string;
  productName: string;
  productImage?: string;
  sku: string;
  category: string;
  currentStock: number;
  minStock: number;
  maxStock: number;
  status: InventoryStatus;
  lastUpdated: string;
  location?: string;
}

// ==========================================
// SHIPMENT TYPES
// ==========================================

export interface ShipmentTimeline {
  id: string;
  label: string;
  timestamp: string;
  location?: string;
  completed: boolean;
}

export interface Shipment {
  id: string;
  shipmentNumber: string;
  orderId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  shippingProvider: string;
  trackingNumber: string;
  status: ShipmentStatus;
  address: string;
  city: string;
  governorate: string;
  shippingCost: number;
  createdAt: string;
  estimatedDelivery: string;
  deliveredAt?: string;
  timeline: ShipmentTimeline[];
}

// ==========================================
// USER TYPES
// ==========================================

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  avatar?: string;
  lastLogin: string;
  createdAt: string;
}

// ==========================================
// NOTIFICATION TYPES
// ==========================================

export type NotificationType = "order" | "inventory" | "shipment" | "system";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  link?: string;
}

// ==========================================
// INVENTORY TRANSACTION TYPES
// ==========================================

export type TransactionType = "in" | "out";

export interface InventoryTransaction {
  id: string;
  type: TransactionType;
  sku: string;
  productName: string;
  category: string;
  quantity: number;
  note?: string;
  createdAt: string;
  createdBy: string;
}

// ==========================================
// REPORT TYPES
// ==========================================

export interface SalesDataPoint {
  date: string;
  sales: number;
  orders: number;
}

export interface OrderStatusCount {
  status: OrderStatus;
  count: number;
}

export interface TopProduct {
  productId: string;
  productName: string;
  sku: string;
  category: string;
  totalSales: number;
  totalRevenue: number;
  image?: string;
}

export interface ReportSummary {
  totalSales: number;
  totalOrders: number;
  averageOrderValue: number;
  newCustomers: number;
  returningCustomers: number;
  deliveredOrders: number;
  cancelledOrders: number;
  returnedOrders: number;
  salesData: SalesDataPoint[];
  orderStatusCounts: OrderStatusCount[];
  topProducts: TopProduct[];
}
