import type { Customer } from "../types";

// Placeholder data — will be synced from Shopify Customers on integration
export const mockCustomers: Customer[] = [
  {
    id: "cust-001",
    name: "عميل تجريبي أول",
    phone: "01000000001",
    email: "customer1@example.com",
    city: "القاهرة",
    governorate: "القاهرة",
    address: "القاهرة، مصر",
    orderCount: 2,
    totalSpent: 1700,
    lastOrderDate: "2025-08-19T09:00:00Z",
    status: "active",
    createdAt: "2025-08-01T00:00:00Z",
  },
  {
    id: "cust-002",
    name: "عميل تجريبي ثاني",
    phone: "01000000002",
    email: "customer2@example.com",
    city: "الإسكندرية",
    governorate: "الإسكندرية",
    address: "الإسكندرية، مصر",
    orderCount: 1,
    totalSpent: 1275,
    lastOrderDate: "2025-08-18T14:00:00Z",
    status: "active",
    createdAt: "2025-08-05T00:00:00Z",
  },
];
