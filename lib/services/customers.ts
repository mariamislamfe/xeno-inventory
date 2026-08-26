import { mockCustomers } from "../mock/customers";
import type { Customer } from "../types";

export interface CustomerFilters {
  search?: string;
  status?: "active" | "inactive" | "";
}

export async function getCustomers(
  filters?: CustomerFilters,
  page = 1,
  pageSize = 10
) {
  let filtered = [...mockCustomers];

  if (filters?.search) {
    const q = filters.search.toLowerCase();
    filtered = filtered.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.city.includes(q)
    );
  }

  if (filters?.status) {
    filtered = filtered.filter((c) => c.status === filters.status);
  }

  const total = filtered.length;
  const totalPages = Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize;
  const data = filtered.slice(start, start + pageSize);

  return { data, total, page, pageSize, totalPages };
}

export async function getCustomerById(id: string): Promise<Customer | null> {
  return mockCustomers.find((c) => c.id === id) ?? null;
}
