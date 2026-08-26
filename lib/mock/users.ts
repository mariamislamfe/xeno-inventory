import type { User } from "../types";

export const mockUsers: User[] = [
  {
    id: "user-001",
    name: "محمد الإداري",
    email: "admin@xeno.com",
    role: "admin",
    status: "active",
    lastLogin: "2025-08-19T08:00:00Z",
    createdAt: "2025-08-01T00:00:00Z",
  },
  {
    id: "user-002",
    name: "مدير المخزون",
    email: "inventory@xeno.com",
    role: "inventory_manager",
    status: "active",
    lastLogin: "2025-08-19T07:30:00Z",
    createdAt: "2025-08-01T00:00:00Z",
  },
];

export const USER_ROLE_LABELS: Record<string, string> = {
  admin: "مدير",
  inventory_manager: "مدير مخزون",
  staff: "موظف",
};
