import type { ReportSummary, SalesDataPoint } from "../types";

// Placeholder data — will be generated from real transactions on integration
export const salesDataThisMonth: SalesDataPoint[] = [
  { date: "1 أغسطس", sales: 500, orders: 1 },
  { date: "18 أغسطس", sales: 1275, orders: 1 },
  { date: "19 أغسطس", sales: 1075, orders: 1 },
];

export const salesDataLastWeek: SalesDataPoint[] = [
  { date: "الأحد", sales: 0, orders: 0 },
  { date: "الاثنين", sales: 0, orders: 0 },
  { date: "الثلاثاء", sales: 0, orders: 0 },
  { date: "الأربعاء", sales: 1275, orders: 1 },
  { date: "الخميس", sales: 1075, orders: 1 },
  { date: "الجمعة", sales: 0, orders: 0 },
  { date: "السبت", sales: 0, orders: 0 },
];

export const salesDataLast3Months: SalesDataPoint[] = [
  { date: "يونيو", sales: 0, orders: 0 },
  { date: "يوليو", sales: 0, orders: 0 },
  { date: "أغسطس", sales: 2850, orders: 3 },
];

export const salesDataToday: SalesDataPoint[] = [
  { date: "9 ص", sales: 1075, orders: 1 },
  { date: "12 م", sales: 1775, orders: 1 },
];

export const mockReportSummary: ReportSummary = {
  totalSales: 2850,
  totalOrders: 3,
  averageOrderValue: 950,
  newCustomers: 2,
  returningCustomers: 0,
  deliveredOrders: 1,
  cancelledOrders: 0,
  returnedOrders: 0,
  salesData: salesDataThisMonth,
  orderStatusCounts: [
    { status: "new", count: 1 },
    { status: "processing", count: 1 },
    { status: "delivered", count: 1 },
  ],
  topProducts: [
    {
      productId: "prod-002",
      productName: "منتج تجريبي ب",
      sku: "SKU-002",
      category: "عام",
      totalSales: 2,
      totalRevenue: 2400,
    },
    {
      productId: "prod-001",
      productName: "منتج تجريبي أ",
      sku: "SKU-001",
      category: "عام",
      totalSales: 3,
      totalRevenue: 1500,
    },
  ],
};
