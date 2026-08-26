"use client";

import React, { useState, useMemo } from "react";
import { Plus, Edit, Trash2, UserCog, Shield, Check, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SearchInput } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { mockUsers } from "@/lib/mock/users";
import type { User } from "@/lib/types";

// ── Permission system ──────────────────────────────────────────────────
type Permission =
  | "dashboard.view"
  | "orders.view" | "orders.edit" | "orders.delete"
  | "customers.view"
  | "products.view" | "products.edit" | "products.delete"
  | "inventory.view" | "inventory.edit"
  | "transactions.view" | "transactions.create"
  | "shipments.view" | "shipments.edit"
  | "reports.view"
  | "users.manage"
  | "settings.manage"
  | "activity.view";

interface Role {
  id: string;
  label: string;
  color: string;
  permissions: Permission[];
  isSystem?: boolean;
}

const PERM_GROUPS: { label: string; perms: { key: Permission; label: string }[] }[] = [
  {
    label: "لوحة التحكم",
    perms: [{ key: "dashboard.view", label: "عرض" }],
  },
  {
    label: "الطلبات",
    perms: [
      { key: "orders.view",   label: "عرض" },
      { key: "orders.edit",   label: "تعديل" },
      { key: "orders.delete", label: "حذف" },
    ],
  },
  {
    label: "العملاء",
    perms: [{ key: "customers.view", label: "عرض" }],
  },
  {
    label: "المنتجات",
    perms: [
      { key: "products.view",   label: "عرض" },
      { key: "products.edit",   label: "تعديل" },
      { key: "products.delete", label: "حذف" },
    ],
  },
  {
    label: "المخزون",
    perms: [
      { key: "inventory.view", label: "عرض" },
      { key: "inventory.edit", label: "تعديل" },
    ],
  },
  {
    label: "المعاملات",
    perms: [
      { key: "transactions.view",   label: "عرض" },
      { key: "transactions.create", label: "إضافة" },
    ],
  },
  {
    label: "الشحنات",
    perms: [
      { key: "shipments.view", label: "عرض" },
      { key: "shipments.edit", label: "تعديل" },
    ],
  },
  {
    label: "التقارير",
    perms: [{ key: "reports.view", label: "عرض" }],
  },
  {
    label: "الإدارة",
    perms: [
      { key: "users.manage",    label: "إدارة المستخدمين" },
      { key: "settings.manage", label: "الإعدادات" },
      { key: "activity.view",   label: "سجل النشاط" },
    ],
  },
];

const ALL_PERMS = PERM_GROUPS.flatMap((g) => g.perms.map((p) => p.key));

const DEFAULT_ROLES: Role[] = [
  {
    id: "admin",
    label: "مدير",
    color: "#ef4444",
    isSystem: true,
    permissions: ALL_PERMS,
  },
  {
    id: "inventory_manager",
    label: "مدير مخزون",
    color: "#2563eb",
    isSystem: true,
    permissions: [
      "dashboard.view",
      "products.view", "products.edit",
      "inventory.view", "inventory.edit",
      "transactions.view", "transactions.create",
      "shipments.view",
      "activity.view",
    ],
  },
  {
    id: "staff",
    label: "موظف",
    color: "#6b7280",
    isSystem: true,
    permissions: [
      "dashboard.view",
      "orders.view",
      "products.view",
      "inventory.view",
      "transactions.view",
      "shipments.view",
    ],
  },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ar-EG", {
    year: "numeric", month: "short", day: "numeric",
  });
}

// ── Edit User Modal ───────────────────────────────────────────────────
function EditUserModal({
  user, roles, onClose, onSave,
}: {
  user: User;
  roles: Role[];
  onClose: () => void;
  onSave: (updated: Partial<User>) => void;
}) {
  const [name,   setName]   = useState(user.name);
  const [email,  setEmail]  = useState(user.email);
  const [role,   setRole]   = useState(user.role);
  const [status, setStatus] = useState(user.status);

  return (
    <Modal open onClose={onClose} title="تعديل المستخدم" size="md">
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">الاسم</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="form-input"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">البريد الإلكتروني</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="form-input"
            dir="ltr"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">الدور</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as User["role"])}
            className="form-input"
          >
            {roles.map((r) => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
          </select>
          {/* Show permissions for selected role */}
          {(() => {
            const r = roles.find((r) => r.id === role);
            if (!r) return null;
            return (
              <div className="mt-2 p-3 bg-[var(--bg-base)] rounded-[var(--radius-md)]">
                <p className="text-[11px] font-semibold text-[var(--text-muted)] mb-1.5">صلاحيات هذا الدور:</p>
                <div className="flex flex-wrap gap-1.5">
                  {r.permissions.slice(0, 6).map((p) => (
                    <span key={p} className="text-[10px] bg-[var(--primary-light)] text-[var(--primary)] px-1.5 py-0.5 rounded">
                      {PERM_GROUPS.flatMap(g => g.perms).find(pp => pp.key === p)?.label ?? p}
                    </span>
                  ))}
                  {r.permissions.length > 6 && (
                    <span className="text-[10px] text-[var(--text-muted)]">+{r.permissions.length - 6} أخرى</span>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">الحالة</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as User["status"])}
            className="form-input"
          >
            <option value="active">نشط</option>
            <option value="inactive">غير نشط</option>
          </select>
        </div>

        <div className="flex gap-2 justify-end pt-2 border-t border-[var(--border-subtle)]">
          <Button variant="secondary" size="sm" onClick={onClose}>إلغاء</Button>
          <Button
            variant="primary" size="sm"
            onClick={() => { onSave({ name, email, role, status }); onClose(); }}
          >
            حفظ التعديلات
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Role Edit Modal ───────────────────────────────────────────────────
function EditRoleModal({
  role, onClose, onSave,
}: {
  role: Role;
  onClose: () => void;
  onSave: (updated: Role) => void;
}) {
  const [label, setLabel] = useState(role.label);
  const [color, setColor] = useState(role.color);
  const [perms, setPerms] = useState<Set<Permission>>(new Set(role.permissions));

  function toggle(p: Permission) {
    const next = new Set(perms);
    next.has(p) ? next.delete(p) : next.add(p);
    setPerms(next);
  }

  function toggleGroup(groupPerms: Permission[]) {
    const allOn = groupPerms.every((p) => perms.has(p));
    const next = new Set(perms);
    if (allOn) groupPerms.forEach((p) => next.delete(p));
    else        groupPerms.forEach((p) => next.add(p));
    setPerms(next);
  }

  return (
    <Modal open onClose={onClose} title={`تعديل الدور: ${role.label}`} size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">اسم الدور</label>
            <input value={label} onChange={(e) => setLabel(e.target.value)} className="form-input" disabled={role.isSystem} />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">اللون</label>
            <div className="flex items-center gap-2">
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-10 h-9 rounded border border-[var(--border-color)] cursor-pointer" disabled={role.isSystem} />
              <span className="text-xs font-mono text-[var(--text-muted)]" dir="ltr">{color}</span>
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-[var(--text-secondary)] mb-3">الصلاحيات</p>
          <div className="space-y-3 max-h-72 overflow-y-auto">
            {PERM_GROUPS.map((group) => {
              const groupKeys = group.perms.map((p) => p.key);
              const allOn = groupKeys.every((k) => perms.has(k));
              return (
                <div key={group.label} className="border border-[var(--border-subtle)] rounded-[var(--radius-md)] overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between px-3 py-2 bg-[var(--bg-base)] hover:bg-[var(--border-subtle)] transition-colors"
                    onClick={() => toggleGroup(groupKeys)}
                    disabled={role.isSystem && role.id === "admin"}
                  >
                    <span className="text-xs font-semibold text-[var(--text-primary)]">{group.label}</span>
                    <span className={`w-4 h-4 rounded flex items-center justify-center ${allOn ? "bg-[var(--primary)]" : "border border-[var(--border-color)]"}`}>
                      {allOn && <Check size={10} className="text-white" />}
                    </span>
                  </button>
                  <div className="flex flex-wrap gap-2 px-3 py-2">
                    {group.perms.map(({ key, label: pl }) => {
                      const on = perms.has(key);
                      return (
                        <button
                          key={key}
                          onClick={() => toggle(key)}
                          disabled={role.isSystem && role.id === "admin"}
                          className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-all ${
                            on
                              ? "bg-[var(--primary)] text-white"
                              : "bg-[var(--bg-base)] text-[var(--text-muted)] border border-[var(--border-color)]"
                          }`}
                        >
                          {on ? <Check size={9} /> : <X size={9} className="opacity-40" />}
                          {pl}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          {role.isSystem && role.id === "admin" && (
            <p className="text-[11px] text-[var(--text-muted)] mt-2">المدير لديه كل الصلاحيات دائماً ولا يمكن تعديله.</p>
          )}
        </div>

        <div className="flex gap-2 justify-end pt-2 border-t border-[var(--border-subtle)]">
          <Button variant="secondary" size="sm" onClick={onClose}>إلغاء</Button>
          <Button
            variant="primary" size="sm"
            onClick={() => { onSave({ ...role, label, color, permissions: [...perms] }); onClose(); }}
          >
            حفظ الدور
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────
export default function UsersPage() {
  const [tab,        setTab]        = useState<"users" | "roles">("users");
  const [users,      setUsers]      = useState<User[]>(mockUsers);
  const [roles,      setRoles]      = useState<Role[]>(DEFAULT_ROLES);
  const [search,     setSearch]     = useState("");
  const [editUser,   setEditUser]   = useState<User | null>(null);
  const [editRole,   setEditRole]   = useState<Role | null>(null);
  const { success, error }          = useToast();

  const filtered = useMemo(() => {
    if (!search) return users;
    const q = search.toLowerCase();
    return users.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }, [users, search]);

  function saveUser(id: string, updates: Partial<User>) {
    setUsers((prev) => prev.map((u) => u.id === id ? { ...u, ...updates } : u));
    success("تم الحفظ", "تم تحديث بيانات المستخدم");
  }

  function saveRole(updated: Role) {
    setRoles((prev) => prev.map((r) => r.id === updated.id ? updated : r));
    success("تم الحفظ", `تم تحديث دور "${updated.label}"`);
  }

  function deleteUser(id: string) {
    const user = users.find((u) => u.id === id);
    if (user?.role === "admin") { error("خطأ", "لا يمكن حذف حساب المدير"); return; }
    setUsers((prev) => prev.filter((u) => u.id !== id));
    success("تم الحذف", "تم حذف المستخدم");
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-page-title">المستخدمون والصلاحيات</h1>
          <p className="text-small mt-0.5">إدارة الحسابات والأدوار وصلاحيات الوصول</p>
        </div>
        {tab === "users" && (
          <Button variant="primary" size="sm" icon={<Plus size={14} />}>
            إضافة مستخدم
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--border-subtle)]">
        {(["users", "roles"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-all border-b-2 ${
              tab === t
                ? "border-[var(--primary)] text-[var(--primary)]"
                : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            {t === "users" ? <><UserCog size={15} /> المستخدمون ({users.length})</> : <><Shield size={15} /> الأدوار والصلاحيات</>}
          </button>
        ))}
      </div>

      {/* ── Users Tab ── */}
      {tab === "users" && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="card p-4">
              <p className="text-xs text-[var(--text-muted)]">إجمالي</p>
              <p className="text-stat-md mt-1" dir="ltr">{users.length}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-[var(--text-muted)]">نشطون</p>
              <p className="text-stat-md text-[var(--success)] mt-1" dir="ltr">
                {users.filter((u) => u.status === "active").length}
              </p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-[var(--text-muted)]">مديرون</p>
              <p className="text-stat-md text-[var(--danger)] mt-1" dir="ltr">
                {users.filter((u) => u.role === "admin").length}
              </p>
            </div>
          </div>

          <div className="card p-3">
            <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث بالاسم أو البريد..." />
          </div>

          <div className="card">
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>المستخدم</th>
                    <th>البريد الإلكتروني</th>
                    <th>الدور</th>
                    <th>الحالة</th>
                    <th>آخر دخول</th>
                    <th className="text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((user) => {
                    const role = roles.find((r) => r.id === user.role);
                    return (
                      <tr key={user.id}>
                        <td>
                          <div className="flex items-center gap-2.5">
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                              style={{ background: role?.color ?? "#6b7280" }}
                            >
                              {user.name.charAt(0)}
                            </div>
                            <p className="text-xs font-semibold text-[var(--text-primary)]">{user.name}</p>
                          </div>
                        </td>
                        <td>
                          <span className="text-xs text-[var(--text-muted)]" dir="ltr">{user.email}</span>
                        </td>
                        <td>
                          <span
                            className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                            style={{ background: (role?.color ?? "#6b7280") + "22", color: role?.color ?? "#6b7280" }}
                          >
                            {role?.label ?? user.role}
                          </span>
                        </td>
                        <td>
                          <Badge variant={user.status === "active" ? "success" : "neutral"} size="sm" dot>
                            {user.status === "active" ? "نشط" : "غير نشط"}
                          </Badge>
                        </td>
                        <td>
                          <span className="text-[11px] text-[var(--text-muted)]">{formatDate(user.lastLogin)}</span>
                        </td>
                        <td>
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => setEditUser(user)}
                              className="p-1.5 rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:bg-[var(--bg-base)] hover:text-[var(--primary)] transition-colors"
                              title="تعديل"
                            >
                              <Edit size={14} />
                            </button>
                            {user.role !== "admin" && (
                              <button
                                onClick={() => deleteUser(user.id)}
                                className="p-1.5 rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:bg-[var(--danger-light)] hover:text-[var(--danger)] transition-colors"
                                title="حذف"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── Roles Tab ── */}
      {tab === "roles" && (
        <div className="space-y-3">
          {roles.map((role) => (
            <div key={role.id} className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ background: role.color }}
                  />
                  <div>
                    <p className="text-sm font-bold text-[var(--text-primary)]">{role.label}</p>
                    {role.isSystem && (
                      <p className="text-[10px] text-[var(--text-muted)]">دور النظام</p>
                    )}
                  </div>
                  <span className="text-[11px] text-[var(--text-muted)] bg-[var(--bg-base)] px-2 py-0.5 rounded-full">
                    {role.permissions.length} صلاحية
                  </span>
                </div>
                <Button variant="secondary" size="sm" icon={<Edit size={13} />} onClick={() => setEditRole(role)}>
                  تعديل
                </Button>
              </div>

              {/* Permission matrix */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {PERM_GROUPS.map((group) => {
                  const granted = group.perms.filter((p) => role.permissions.includes(p.key));
                  if (granted.length === 0) return null;
                  return (
                    <div key={group.label} className="text-[11px] bg-[var(--bg-base)] rounded-[var(--radius-sm)] px-2 py-1.5">
                      <span className="font-semibold text-[var(--text-secondary)]">{group.label}: </span>
                      <span className="text-[var(--text-muted)]">{granted.map((p) => p.label).join(" · ")}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modals ── */}
      {editUser && (
        <EditUserModal
          user={editUser}
          roles={roles}
          onClose={() => setEditUser(null)}
          onSave={(updates) => saveUser(editUser.id, updates)}
        />
      )}
      {editRole && (
        <EditRoleModal
          role={editRole}
          onClose={() => setEditRole(null)}
          onSave={saveRole}
        />
      )}
    </div>
  );
}
