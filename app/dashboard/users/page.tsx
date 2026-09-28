"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Plus, Edit, Trash2, UserCog, Loader2,
  RefreshCw, Mail, Lock, User as UserIcon, Eye, EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SearchInput } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";

// ── Types ──────────────────────────────────────────────────────────────────────
interface AppUser {
  id:         string;
  email:      string;
  fullName:   string;
  role:       "admin" | "employee";
  createdAt:  string;
  lastSignIn: string | null;
}

const ROLE_LABELS: Record<string, string> = { admin: "مدير", employee: "موظف" };
const ROLE_COLORS: Record<string, string> = { admin: "#ef4444", employee: "#6b7280" };

function formatDate(iso: string | null) {
  if (!iso) return "لم يسجل دخولاً بعد";
  return new Date(iso).toLocaleDateString("ar-EG", {
    year: "numeric", month: "short", day: "numeric",
  });
}

// ── Add User Modal ─────────────────────────────────────────────────────────────
interface AddUserModalProps {
  onClose: () => void;
  onAdded: () => void;
}

function AddUserModal({ onClose, onAdded }: AddUserModalProps) {
  const [fullName, setFullName] = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [role,     setRole]     = useState<"admin" | "employee">("employee");
  const [showPass, setShowPass] = useState(false);
  const [saving,   setSaving]   = useState(false);
  const { success, error } = useToast();

  async function save() {
    if (!fullName.trim() || !email.trim() || !password) return;
    setSaving(true);
    try {
      const res  = await fetch("/api/users", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ fullName: fullName.trim(), email: email.trim(), password, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "فشل الإضافة");
      success("تم الإضافة ✓", `تم إنشاء حساب ${fullName} بنجاح`);
      onAdded();
      onClose();
    } catch (err) {
      error("خطأ", err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={saving ? () => {} : onClose}
      title="إضافة موظف جديد"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>إلغاء</Button>
          <Button
            variant="primary"
            onClick={save}
            loading={saving}
            disabled={!fullName.trim() || !email.trim() || password.length < 6}
          >
            إنشاء الحساب
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Full name */}
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">الاسم الكامل</label>
          <div className="relative">
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="form-input w-full pl-9"
              placeholder="مثال: أحمد محمد"
              autoFocus
            />
            <UserIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          </div>
        </div>

        {/* Email */}
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">البريد الإلكتروني</label>
          <div className="relative">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="form-input w-full pl-9"
              placeholder="ahmed@zeno.com"
              dir="ltr"
            />
            <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          </div>
        </div>

        {/* Password */}
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
            كلمة المرور <span className="text-[var(--text-muted)] font-normal">(6 أحرف على الأقل)</span>
          </label>
          <div className="relative">
            <input
              type={showPass ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="form-input w-full pl-16"
              placeholder="••••••••"
              dir="ltr"
            />
            <Lock size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--primary)]"
            >
              {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>

        {/* Role */}
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">الدور</label>
          <div className="grid grid-cols-2 gap-2">
            {(["employee", "admin"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRole(r)}
                className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-[var(--radius-md)] border text-xs font-semibold transition-all ${
                  role === r
                    ? "border-[var(--primary)] bg-[var(--primary-light)] text-[var(--primary)]"
                    : "border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--primary)]"
                }`}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: ROLE_COLORS[r] }} />
                {ROLE_LABELS[r]}
              </button>
            ))}
          </div>
          {role === "admin" && (
            <p className="text-[11px] text-[var(--danger)] mt-1.5">
              ⚠ المدير لديه وصول كامل لكل بيانات النظام
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ── Edit User Modal ────────────────────────────────────────────────────────────
interface EditUserModalProps {
  user:    AppUser;
  onClose: () => void;
  onSaved: () => void;
}

function EditUserModal({ user, onClose, onSaved }: EditUserModalProps) {
  const [fullName, setFullName] = useState(user.fullName);
  const [role,     setRole]     = useState<"admin" | "employee">(user.role);
  const [saving,   setSaving]   = useState(false);
  const { success, error } = useToast();

  async function save() {
    setSaving(true);
    try {
      const res  = await fetch(`/api/users/${user.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ fullName: fullName.trim(), role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "فشل التحديث");
      success("تم التحديث", `تم تحديث بيانات ${fullName}`);
      onSaved();
      onClose();
    } catch (err) {
      error("خطأ", err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={saving ? () => {} : onClose}
      title="تعديل بيانات الموظف"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>إلغاء</Button>
          <Button variant="primary" onClick={save} loading={saving} disabled={!fullName.trim()}>
            حفظ
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">الاسم الكامل</label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="form-input w-full"
            autoFocus
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">البريد الإلكتروني</label>
          <input value={user.email} disabled className="form-input w-full opacity-60" dir="ltr" />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">الدور</label>
          <div className="grid grid-cols-2 gap-2">
            {(["employee", "admin"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRole(r)}
                className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-[var(--radius-md)] border text-xs font-semibold transition-all ${
                  role === r
                    ? "border-[var(--primary)] bg-[var(--primary-light)] text-[var(--primary)]"
                    : "border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--primary)]"
                }`}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: ROLE_COLORS[r] }} />
                {ROLE_LABELS[r]}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function UsersPage() {
  const [users,     setUsers]     = useState<AppUser[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState("");
  const [showAdd,   setShowAdd]   = useState(false);
  const [editUser,  setEditUser]  = useState<AppUser | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { success, error } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/users");
      const data = await res.json();
      if (res.ok) setUsers(data.users ?? []);
    } catch { /* silent */ }
    finally   { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (!search) return users;
    const q = search.toLowerCase();
    return users.filter((u) =>
      u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  }, [users, search]);

  async function handleDelete(user: AppUser) {
    if (!confirm(`حذف حساب "${user.fullName}"؟ العملية لا يمكن التراجع عنها.`)) return;
    setDeletingId(user.id);
    try {
      const res  = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "فشل الحذف");
      success("تم الحذف", `تم حذف حساب ${user.fullName}`);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
    } catch (err) {
      error("خطأ", err instanceof Error ? err.message : String(err));
    } finally {
      setDeletingId(null);
    }
  }

  const adminCount    = users.filter((u) => u.role === "admin").length;
  const employeeCount = users.filter((u) => u.role === "employee").length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-page-title">المستخدمون</h1>
          <p className="text-small mt-0.5">إدارة حسابات موظفي شركة زينو</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary" size="sm"
            icon={loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            onClick={load} disabled={loading}
          >
            تحديث
          </Button>
          <Button
            variant="primary" size="sm"
            icon={<Plus size={14} />}
            onClick={() => setShowAdd(true)}
          >
            إضافة موظف
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4">
          <p className="text-xs text-[var(--text-muted)]">إجمالي الحسابات</p>
          <p className="text-stat-md mt-1">{users.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-[var(--text-muted)]">مديرون</p>
          <p className="text-stat-md text-[var(--danger)] mt-1">{adminCount}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-[var(--text-muted)]">موظفون</p>
          <p className="text-stat-md text-[var(--primary)] mt-1">{employeeCount}</p>
        </div>
      </div>

      {/* Search */}
      <div className="card p-3">
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث بالاسم أو البريد الإلكتروني..."
        />
      </div>

      {/* Table */}
      <div className="card">
        {loading ? (
          <div className="flex items-center justify-center gap-3 p-16">
            <Loader2 size={20} className="animate-spin text-[var(--primary)]" />
            <p className="text-sm text-[var(--text-muted)]">جارٍ التحميل...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-16 text-center">
            <UserCog size={32} className="text-[var(--text-muted)]" />
            <p className="text-sm text-[var(--text-muted)]">
              {search ? `لا توجد نتائج لـ "${search}"` : "لا يوجد مستخدمون بعد"}
            </p>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>الموظف</th>
                  <th>البريد الإلكتروني</th>
                  <th>الدور</th>
                  <th>آخر دخول</th>
                  <th>تاريخ الإنشاء</th>
                  <th className="text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                          style={{ background: ROLE_COLORS[user.role] ?? "#6b7280" }}
                        >
                          {user.fullName.charAt(0)}
                        </div>
                        <p className="text-xs font-semibold text-[var(--text-primary)]">{user.fullName}</p>
                      </div>
                    </td>
                    <td>
                      <span className="text-xs text-[var(--text-muted)]" dir="ltr">{user.email}</span>
                    </td>
                    <td>
                      <Badge
                        variant={user.role === "admin" ? "danger" : "neutral"}
                        size="sm"
                        dot
                      >
                        {ROLE_LABELS[user.role] ?? user.role}
                      </Badge>
                    </td>
                    <td>
                      <span className="text-[11px] text-[var(--text-muted)]">{formatDate(user.lastSignIn)}</span>
                    </td>
                    <td>
                      <span className="text-[11px] text-[var(--text-muted)]">{formatDate(user.createdAt)}</span>
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
                        <button
                          onClick={() => handleDelete(user)}
                          disabled={deletingId === user.id || adminCount === 1 && user.role === "admin"}
                          className="p-1.5 rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:bg-[var(--danger-light)] hover:text-[var(--danger)] transition-colors disabled:opacity-30"
                          title={adminCount === 1 && user.role === "admin" ? "لا يمكن حذف المدير الوحيد" : "حذف"}
                        >
                          {deletingId === user.id
                            ? <Loader2 size={14} className="animate-spin" />
                            : <Trash2 size={14} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {showAdd && (
        <AddUserModal
          onClose={() => setShowAdd(false)}
          onAdded={load}
        />
      )}
      {editUser && (
        <EditUserModal
          user={editUser}
          onClose={() => setEditUser(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}
