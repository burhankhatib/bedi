'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useLanguage } from '@/components/LanguageContext'
import { useToast } from '@/components/ui/ToastProvider'
import { Users, Plus, Pencil, Trash2, Crown, Mail } from 'lucide-react'
import type { StaffPermission } from '@/lib/staff-permissions'
import { STAFF_PERMISSIONS, ROLE_DEFAULTS } from '@/lib/staff-permissions'

type StaffEntry = {
  _id: string
  email: string
  displayName: string | null
  role: string
  permissions: StaffPermission[]
  createdAt: string | null
  isOwnerOrCoOwner: boolean
}

const ROLE_LABELS: Record<string, { en: string; ar: string }> = {
  waiter: { en: 'Waiter', ar: 'نادل' },
  cashier: { en: 'Cashier', ar: 'كاشير' },
  manager: { en: 'Manager', ar: 'مدير' },
  custom: { en: 'Custom', ar: 'مخصص' },
}

export function StaffManageClient({
  slug,
  ownerEmail,
  businessName,
}: {
  slug: string
  ownerEmail: string
  businessName: string
}) {
  const [staff, setStaff] = useState<StaffEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [addEmail, setAddEmail] = useState('')
  const [addDisplayName, setAddDisplayName] = useState('')
  const [addRole, setAddRole] = useState<string>('waiter')
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editRole, setEditRole] = useState<string>('waiter')
  const [editPermissions, setEditPermissions] = useState<StaffPermission[]>([])
  const { t, lang } = useLanguage()
  const { showToast } = useToast()
  const slugRef = useRef(slug)

  const api = (path: string, options?: RequestInit) =>
    fetch(`/api/tenants/${slug}${path}`, { ...options, credentials: 'include', headers: { 'Content-Type': 'application/json', ...options?.headers } })

  useEffect(() => {
    if (slugRef.current !== slug) slugRef.current = slug
    setLoading(true)
    api('/staff')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load')
        return r.json()
      })
      .then((data) => setStaff(Array.isArray(data?.staff) ? data.staff : []))
      .catch(() => setStaff([]))
      .finally(() => setLoading(false))
  }, [slug])

  const handleAdd = async () => {
    const email = addEmail.trim()
    if (!email) {
      showToast('Enter an email address', 'أدخل البريد الإلكتروني', 'error')
      return
    }
    setAdding(true)
    try {
      const res = await api('/staff', {
        method: 'POST',
        body: JSON.stringify({
          email,
          displayName: addDisplayName.trim() || undefined,
          role: addRole,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(data?.error || 'Failed to add', data?.error || 'فشل الإضافة', 'error')
        return
      }
      showToast('Staff added. They can sign in with this email.', 'تمت إضافة الموظف. يمكنه تسجيل الدخول بهذا البريد.', 'success')
      setAddEmail('')
      setAddDisplayName('')
      setAddRole('waiter')
      setStaff((prev) => [...prev, { ...data.staff, isOwnerOrCoOwner: false, createdAt: new Date().toISOString() }])
    } finally {
      setAdding(false)
    }
  }

  const handleUpdate = async (id: string) => {
    setAdding(true)
    try {
      const res = await api(`/staff/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ role: editRole, permissions: editRole === 'custom' ? editPermissions : undefined }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(data?.error || 'Failed to update', 'فشل التحديث', 'error')
        return
      }
      showToast('Staff updated', 'تم تحديث الموظف', 'success')
      setStaff((prev) => prev.map((s) => (s._id === id ? { ...s, role: data.staff?.role ?? s.role, permissions: data.staff?.permissions ?? s.permissions } : s)))
      setEditingId(null)
    } finally {
      setAdding(false)
    }
  }

  const handleRemove = async (id: string, email: string) => {
    if (!confirm(t('Remove this staff member?', 'إزالة هذا الموظف؟'))) return
    setAdding(true)
    try {
      const res = await api(`/staff/${id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(data?.error || 'Failed to remove', 'فشل الحذف', 'error')
        return
      }
      showToast('Staff removed', 'تمت إزالة الموظف', 'success')
      setStaff((prev) => prev.filter((s) => s._id !== id))
    } finally {
      setAdding(false)
    }
  }

  const togglePermission = (p: StaffPermission) => {
    setEditPermissions((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]))
  }

  const roleLabel = (role: string) => (lang === 'ar' ? ROLE_LABELS[role]?.ar : ROLE_LABELS[role]?.en) || role

  return (
    <div className="mt-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Users className="size-6" />
          {t('Staff', 'الموظفون')}
        </h1>
        <p className="mt-1 text-slate-400">
          {t('Add waiters, cashiers, or managers. Each can sign in with their email and get their own push notifications.', 'أضف النادلين أو الكاشير أو المديرين. كل واحد يسجّل الدخول ببريده ويستقبل إشعاراته.')}
        </p>
      </div>

      {/* Owner row (non-removable) */}
      {ownerEmail && (
        <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-amber-500/20 p-2">
              <Crown className="size-5 text-amber-400" />
            </div>
            <div>
              <p className="font-medium text-white">{t('Owner', 'المالك')}</p>
              <p className="text-sm text-slate-400 flex items-center gap-1">
                <Mail className="size-3.5" />
                {ownerEmail}
              </p>
            </div>
          </div>
          <span className="text-xs text-slate-500">{t('Full access', 'صلاحية كاملة')}</span>
        </div>
      )}

      {/* List */}
      <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 divide-y divide-slate-800/60">
        {loading ? (
          <div className="p-6 text-slate-400">{t('Loading…', 'جاري التحميل…')}</div>
        ) : staff.length === 0 && !ownerEmail ? (
          <div className="p-6 text-slate-400">{t('No staff yet. Add someone below.', 'لا موظفين بعد. أضف من أدناه.')}</div>
        ) : (
          staff.map((s) => (
            <div key={s._id} className="p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium text-white">{s.displayName || s.email}</p>
                {s.displayName && <p className="text-sm text-slate-400">{s.email}</p>}
              </div>
              <div className="flex items-center gap-2">
                {editingId === s._id ? (
                  <>
                    <select
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value)}
                      className="rounded-lg bg-slate-800 border border-slate-600 text-white text-sm px-2 py-1.5"
                    >
                      {(['waiter', 'cashier', 'manager', 'custom'] as const).map((r) => (
                        <option key={r} value={r}>{roleLabel(r)}</option>
                      ))}
                    </select>
                    {editRole === 'custom' && (
                      <div className="flex flex-wrap gap-1">
                        {STAFF_PERMISSIONS.slice(0, 5).map((p) => (
                          <label key={p} className="flex items-center gap-1 text-xs">
                            <input
                              type="checkbox"
                              checked={editPermissions.includes(p)}
                              onChange={() => togglePermission(p)}
                            />
                            {p}
                          </label>
                        ))}
                      </div>
                    )}
                    <Button size="sm" onClick={() => handleUpdate(s._id)} disabled={adding}>{t('Save', 'حفظ')}</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>{t('Cancel', 'إلغاء')}</Button>
                  </>
                ) : (
                  <>
                    <span className="text-sm text-slate-400">{roleLabel(s.role)}</span>
                    {!s.isOwnerOrCoOwner && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => { setEditingId(s._id); setEditRole(s.role); setEditPermissions(s.permissions); }} disabled={adding}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300" onClick={() => handleRemove(s._id, s.email)} disabled={adding}>
                          <Trash2 className="size-4" />
                        </Button>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add form */}
      <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 p-4">
        <h2 className="mb-3 font-semibold text-white flex items-center gap-2">
          <Plus className="size-4" />
          {t('Add staff member', 'إضافة موظف')}
        </h2>
        <p className="text-xs text-slate-500 mb-3">
          {t('They must sign up with the same email (Clerk). After adding, they will see this business on their dashboard.', 'يجب أن يسجّلوا بنفس البريد. بعد الإضافة سيرون هذا المتجر في لوحة التحكم.')}
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px]">
            <label className="mb-1 block text-xs font-medium text-slate-400">{t('Email', 'البريد الإلكتروني')}</label>
            <Input
              type="email"
              value={addEmail}
              onChange={(e) => setAddEmail(e.target.value)}
              placeholder="staff@example.com"
              className="h-10 bg-slate-800 border-slate-600 text-white"
            />
          </div>
          <div className="min-w-[140px]">
            <label className="mb-1 block text-xs font-medium text-slate-400">{t('Name (optional)', 'الاسم (اختياري)')}</label>
            <Input
              value={addDisplayName}
              onChange={(e) => setAddDisplayName(e.target.value)}
              placeholder={t('Display name', 'الاسم للعرض')}
              className="h-10 bg-slate-800 border-slate-600 text-white"
            />
          </div>
          <div className="min-w-[120px]">
            <label className="mb-1 block text-xs font-medium text-slate-400">{t('Role', 'الدور')}</label>
            <select
              value={addRole}
              onChange={(e) => setAddRole(e.target.value)}
              className="h-10 w-full rounded-lg bg-slate-800 border border-slate-600 text-white px-3"
            >
              {(['waiter', 'cashier', 'manager'] as const).map((r) => (
                <option key={r} value={r}>{roleLabel(r)}</option>
              ))}
            </select>
          </div>
          <Button onClick={handleAdd} disabled={adding || !addEmail.trim()}>
            {adding ? t('Adding…', 'جاري الإضافة…') : t('Add', 'إضافة')}
          </Button>
        </div>
      </div>
    </div>
  )
}
