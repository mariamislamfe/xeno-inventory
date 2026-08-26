import { mockShipments } from "../mock/shipments";
import type { Shipment, ShipmentStatus } from "../types";

export interface ShipmentFilters {
  search?: string;
  status?: ShipmentStatus | "";
}

export async function getShipments(
  filters?: ShipmentFilters,
  page = 1,
  pageSize = 10
) {
  let filtered = [...mockShipments];

  if (filters?.search) {
    const q = filters.search.toLowerCase();
    filtered = filtered.filter(
      (s) =>
        s.shipmentNumber.toLowerCase().includes(q) ||
        s.trackingNumber.toLowerCase().includes(q) ||
        s.customerName.toLowerCase().includes(q) ||
        s.orderNumber.includes(q)
    );
  }

  if (filters?.status) {
    filtered = filtered.filter((s) => s.status === filters.status);
  }

  const total = filtered.length;
  const totalPages = Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize;
  const data = filtered.slice(start, start + pageSize);

  return { data, total, page, pageSize, totalPages };
}

export async function getShipmentById(id: string): Promise<Shipment | null> {
  return mockShipments.find((s) => s.id === id) ?? null;
}

export function getShipmentStats() {
  const total = mockShipments.length;
  const preparing = mockShipments.filter((s) => s.status === "preparing").length;
  const inDelivery = mockShipments.filter((s) => s.status === "in_delivery").length;
  const delivered = mockShipments.filter((s) => s.status === "delivered").length;
  const returned = mockShipments.filter((s) => s.status === "returned").length;

  return { total, preparing, inDelivery, delivered, returned };
}
