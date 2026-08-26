import type { Shipment } from "../types";

// Placeholder data — will be populated via shipping company API on integration
export const mockShipments: Shipment[] = [
  {
    id: "ship-001",
    shipmentNumber: "SHP-2025-001",
    orderId: "ord-002",
    orderNumber: "#10002",
    customerId: "cust-002",
    customerName: "عميل تجريبي ثاني",
    customerPhone: "01000000002",
    shippingProvider: "—",
    trackingNumber: "TRK-000001",
    status: "delivered",
    address: "الإسكندرية، مصر",
    city: "الإسكندرية",
    governorate: "الإسكندرية",
    shippingCost: 75,
    createdAt: "2025-08-18T17:00:00Z",
    estimatedDelivery: "2025-08-19T18:00:00Z",
    deliveredAt: "2025-08-19T10:00:00Z",
    timeline: [
      { id: "st1", label: "تم استلام الشحنة", timestamp: "2025-08-18T17:00:00Z", location: "الإسكندرية", completed: true },
      { id: "st2", label: "جاري التجهيز", timestamp: "2025-08-18T18:00:00Z", location: "مركز الفرز", completed: true },
      { id: "st3", label: "تم الشحن", timestamp: "2025-08-19T07:00:00Z", location: "الإسكندرية", completed: true },
      { id: "st4", label: "في الطريق للتسليم", timestamp: "2025-08-19T09:00:00Z", location: "الإسكندرية", completed: true },
      { id: "st5", label: "تم التوصيل", timestamp: "2025-08-19T10:00:00Z", location: "الإسكندرية", completed: true },
    ],
  },
];

export const SHIPMENT_STATUS_LABELS: Record<string, string> = {
  preparing: "جاري التجهيز",
  shipped: "تم الشحن",
  in_delivery: "قيد التوصيل",
  delivered: "تم التوصيل",
  failed: "فشل التوصيل",
  returned: "مرتجع",
};
