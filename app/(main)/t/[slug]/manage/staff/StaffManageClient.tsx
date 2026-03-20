'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
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
  status: 'active' | 'suspended' | 'archived'
  phone: string | null
  whatsappPhone: string | null
  permissions: StaffPermission[]
  notificationRules?: {
    receiveFcm?: boolean
    receiveWhatsapp?: boolean
    newOrder?: boolean
    unacceptedOrderReminder?: boolean
  } | null
  workSchedule?: {
    timezone?: string
    days?: Array<{
      dayOfWeek: number
      enabled?: boolean
      start?: string
      end?: string
    }>
  } | null
  createdAt: string | null
  isOwnerOrCoOwner: boolean
}

type DaySchedule = {
  dayOfWeek: number
  enabled: boolean
  start: string
  end: string
}

const ROLE_LABELS: Record<string, { en: string; ar: string }> = {
  waiter: { en: 'Waiter', ar: 'نادل' },
  cashier: { en: 'Cashier', ar: 'كاشير' },
  kitchen: { en: 'Kitchen', ar: 'مطبخ' },
  dispatcher: { en: 'Dispatcher', ar: 'موزع' },
  accountant: { en: 'Accountant', ar: 'محاسب' },
  manager: { en: 'Manager', ar: 'مدير' },
  custom: { en: 'Custom', ar: 'مخصص' },
}

const ROLE_OPTIONS = ['waiter', 'cashier', 'kitchen', 'dispatcher', 'accountant', 'manager', 'custom'] as const
const MANAGEABLE_PERMISSIONS = STAFF_PERMISSIONS.filter((p) => p !== 'transfer') as StaffPermission[]

const STATUS_LABELS: Record<string, { en: string; ar: string }> = {
  active: { en: 'Active', ar: 'نشط' },
  suspended: { en: 'Suspended', ar: 'معلق' },
  archived: { en: 'Archived', ar: 'مؤرشف' },
}

const WEEK_DAYS: { en: string; ar: string }[] = [
  { en: 'Sunday', ar: 'الأحد' },
  { en: 'Monday', ar: 'الإثنين' },
  { en: 'Tuesday', ar: 'الثلاثاء' },
  { en: 'Wednesday', ar: 'الأربعاء' },
  { en: 'Thursday', ar: 'الخميس' },
  { en: 'Friday', ar: 'الجمعة' },
  { en: 'Saturday', ar: 'السبت' },
]

const PERMISSION_LABELS: Record<StaffPermission, { en: string; ar: string }> = {
  orders: { en: 'Orders', ar: 'الطلبات' },
  history: { en: 'History', ar: 'السجل' },
  staff_manage: { en: 'Staff Manage', ar: 'إدارة الموظفين' },
  billing: { en: 'Billing', ar: 'الفوترة' },
  payroll: { en: 'Payroll', ar: 'الرواتب' },
  settings_business: { en: 'Business Settings', ar: 'إعدادات النشاط' },
  settings_menu: { en: 'Menu Settings', ar: 'إعدادات القائمة' },
  settings_tables: { en: 'Tables Settings', ar: 'إعدادات الطاولات' },
  settings_drivers: { en: 'Drivers Settings', ar: 'إعدادات السائقين' },
  analytics: { en: 'Analytics', ar: 'التحليلات' },
  transfer: { en: 'Transfer Business', ar: 'نقل النشاط' },
}

function emptyWeekSchedule(): DaySchedule[] {
  return WEEK_DAYS.map((_, idx) => ({
    dayOfWeek: idx,
    enabled: idx <= 4,
    start: '09:00',
    end: '17:00',
  }))
}

function hydrateWeekSchedule(raw?: StaffEntry['workSchedule']): DaySchedule[] {
  const base = emptyWeekSchedule()
  const rows = raw?.days ?? []
  for (const row of rows) {
    if (!Number.isInteger(row.dayOfWeek) || row.dayOfWeek < 0 || row.dayOfWeek > 6) continue
    base[row.dayOfWeek] = {
      dayOfWeek: row.dayOfWeek,
      enabled: row.enabled !== false,
      start: row.start?.trim() || '09:00',
      end: row.end?.trim() || '17:00',
    }
  }
  return base
}

export function StaffManageClient({
  slug,
  ownerEmail,
}: {
  slug: string
  ownerEmail: string
}) {
  const [staff, setStaff] = useState<StaffEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [addEmail, setAddEmail] = useState('')
  const [addDisplayName, setAddDisplayName] = useState('')
  const [addRole, setAddRole] = useState<(typeof ROLE_OPTIONS)[number]>('waiter')
  const [addPermissions, setAddPermissions] = useState<StaffPermission[]>([])
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDisplayName, setEditDisplayName] = useState('')
  const [editRole, setEditRole] = useState<string>('waiter')
  const [editStatus, setEditStatus] = useState<'active' | 'suspended' | 'archived'>('active')
  const [editPhone, setEditPhone] = useState('')
  const [editWhatsappPhone, setEditWhatsappPhone] = useState('')
  const [editPermissions, setEditPermissions] = useState<StaffPermission[]>([])
  const [editTimezone, setEditTimezone] = useState('Asia/Jerusalem')
  const [editSchedule, setEditSchedule] = useState<DaySchedule[]>(emptyWeekSchedule())
  const [editReceiveFcm, setEditReceiveFcm] = useState(true)
  const [editReceiveWhatsapp, setEditReceiveWhatsapp] = useState(false)
  const [editNotifyNewOrder, setEditNotifyNewOrder] = useState(true)
  const [editNotifyUnaccepted, setEditNotifyUnaccepted] = useState(true)
  const { t, lang } = useLanguage()
  const { showToast } = useToast()
  const slugRef = useRef(slug)

  const api = useCallback(
    (path: string, options?: RequestInit) =>
      fetch(`/api/tenants/${slug}${path}`, {
        ...options,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...options?.headers },
      }),
    [slug]
  )

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
  }, [slug, api])

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
          permissions: addRole === 'custom' ? addPermissions : undefined,
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
      setAddPermissions([])
      setStaff((prev) => [
        ...prev,
        {
          ...data.staff,
          status: data.staff?.status || 'active',
          phone: data.staff?.phone ?? null,
          whatsappPhone: data.staff?.whatsappPhone ?? null,
          permissions: data.staff?.permissions ?? [],
          isOwnerOrCoOwner: false,
          createdAt: new Date().toISOString(),
        },
      ])
    } finally {
      setAdding(false)
    }
  }

  const handleUpdate = async (id: string) => {
    setAdding(true)
    try {
      const res = await api(`/staff/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          displayName: editDisplayName,
          role: editRole,
          status: editStatus,
          phone: editPhone,
          whatsappPhone: editWhatsappPhone,
          permissions: editRole === 'custom' ? editPermissions : undefined,
          notificationRules: {
            receiveFcm: editReceiveFcm,
            receiveWhatsapp: editReceiveWhatsapp,
            newOrder: editNotifyNewOrder,
            unacceptedOrderReminder: editNotifyUnaccepted,
          },
          workSchedule: {
            timezone: editTimezone,
            days: editSchedule.map((d) => ({
              dayOfWeek: d.dayOfWeek,
              enabled: d.enabled,
              start: d.start,
              end: d.end,
            })),
          },
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(data?.error || 'Failed to update', 'فشل التحديث', 'error')
        return
      }
      showToast('Staff updated', 'تم تحديث الموظف', 'success')
      setStaff((prev) =>
        prev.map((s) =>
          s._id === id
            ? {
                ...s,
                displayName: data.staff?.displayName ?? s.displayName,
                role: data.staff?.role ?? s.role,
                status: data.staff?.status ?? s.status,
                phone: data.staff?.phone ?? s.phone,
                whatsappPhone: data.staff?.whatsappPhone ?? s.whatsappPhone,
                permissions: data.staff?.permissions ?? s.permissions,
                notificationRules: {
                  receiveFcm: editReceiveFcm,
                  receiveWhatsapp: editReceiveWhatsapp,
                  newOrder: editNotifyNewOrder,
                  unacceptedOrderReminder: editNotifyUnaccepted,
                },
              }
            : s
        )
      )
      setEditingId(null)
    } finally {
      setAdding(false)
    }
  }

  const handleRemove = async (id: string) => {
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
  const toggleAddPermission = (p: StaffPermission) => {
    setAddPermissions((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]))
  }
  const updateScheduleRow = (dayOfWeek: number, patch: Partial<DaySchedule>) => {
    setEditSchedule((prev) => prev.map((row) => (row.dayOfWeek === dayOfWeek ? { ...row, ...patch } : row)))
  }
  const effectiveRolePermissions = (role: string, perms: StaffPermission[]) =>
    role === 'custom' ? perms : ((ROLE_DEFAULTS[role] ?? []) as StaffPermission[])

  const roleLabel = (role: string) => (lang === 'ar' ? ROLE_LABELS[role]?.ar : ROLE_LABELS[role]?.en) || role
  const statusLabel = (status: string) => (lang === 'ar' ? STATUS_LABELS[status]?.ar : STATUS_LABELS[status]?.en) || status
  const permissionLabel = (p: StaffPermission) =>
    (lang === 'ar' ? PERMISSION_LABELS[p]?.ar : PERMISSION_LABELS[p]?.en) || p

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
            <div key={s._id} className="p-4 space-y-3">
              <div>
                <p className="font-medium text-white">{s.displayName || s.email}</p>
                {s.displayName && <p className="text-sm text-slate-400">{s.email}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                {editingId === s._id ? (
                  <>
                    <select
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value)}
                      className="rounded-lg bg-slate-800 border border-slate-600 text-white text-sm px-2 py-1.5"
                    >
                      {ROLE_OPTIONS.map((r) => (
                        <option key={r} value={r}>{roleLabel(r)}</option>
                      ))}
                    </select>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as 'active' | 'suspended' | 'archived')}
                      className="rounded-lg bg-slate-800 border border-slate-600 text-white text-sm px-2 py-1.5"
                    >
                      {(['active', 'suspended', 'archived'] as const).map((s) => (
                        <option key={s} value={s}>{statusLabel(s)}</option>
                      ))}
                    </select>
                    <Input
                      value={editDisplayName}
                      onChange={(e) => setEditDisplayName(e.target.value)}
                      placeholder={t('Display name', 'اسم العرض')}
                      className="h-8 w-40 bg-slate-800 border-slate-600 text-white"
                    />
                    <Input
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      placeholder={t('Mobile phone', 'رقم الجوال')}
                      className="h-8 w-36 bg-slate-800 border-slate-600 text-white"
                    />
                    <Input
                      value={editWhatsappPhone}
                      onChange={(e) => setEditWhatsappPhone(e.target.value)}
                      placeholder={t('WhatsApp', 'واتساب')}
                      className="h-8 w-36 bg-slate-800 border-slate-600 text-white"
                    />
                    {editRole === 'custom' && (
                      <div className="w-full flex flex-wrap gap-2 rounded-lg border border-slate-700 p-2">
                        {MANAGEABLE_PERMISSIONS.map((p) => (
                          <label key={p} className="flex items-center gap-1 text-xs text-slate-300">
                            <input
                              type="checkbox"
                              checked={editPermissions.includes(p)}
                              onChange={() => togglePermission(p)}
                            />
                            {permissionLabel(p)}
                          </label>
                        ))}
                      </div>
                    )}
                    <div className="w-full rounded-lg border border-slate-700 p-3 space-y-2">
                      <p className="text-xs font-medium text-slate-300">
                        {t('Notification preferences', 'تفضيلات الإشعارات')}
                      </p>
                      <div className="flex flex-wrap gap-3 text-xs text-slate-300">
                        <label className="flex items-center gap-1">
                          <input type="checkbox" checked={editReceiveFcm} onChange={(e) => setEditReceiveFcm(e.target.checked)} />
                          {t('Receive FCM/Web Push', 'استقبال FCM/ويب بوش')}
                        </label>
                        <label className="flex items-center gap-1">
                          <input type="checkbox" checked={editReceiveWhatsapp} onChange={(e) => setEditReceiveWhatsapp(e.target.checked)} />
                          {t('Receive WhatsApp', 'استقبال واتساب')}
                        </label>
                        <label className="flex items-center gap-1">
                          <input type="checkbox" checked={editNotifyNewOrder} onChange={(e) => setEditNotifyNewOrder(e.target.checked)} />
                          {t('New order alerts', 'تنبيهات الطلب الجديد')}
                        </label>
                        <label className="flex items-center gap-1">
                          <input type="checkbox" checked={editNotifyUnaccepted} onChange={(e) => setEditNotifyUnaccepted(e.target.checked)} />
                          {t('3-min unaccepted reminder', 'تذكير عدم القبول بعد 3 دقائق')}
                        </label>
                      </div>
                    </div>
                    <div className="w-full rounded-lg border border-slate-700 p-3 space-y-2">
                      <p className="text-xs font-medium text-slate-300">
                        {t('Working schedule', 'جدول العمل')}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">{t('Timezone', 'المنطقة الزمنية')}</span>
                        <Input
                          value={editTimezone}
                          onChange={(e) => setEditTimezone(e.target.value)}
                          className="h-8 w-44 bg-slate-800 border-slate-600 text-white"
                          placeholder="Asia/Jerusalem"
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {editSchedule.map((d) => (
                          <div key={d.dayOfWeek} className="flex items-center gap-2 rounded border border-slate-700 p-2">
                            <label className="text-xs text-slate-300 w-16">
                              <input
                                type="checkbox"
                                checked={d.enabled}
                                onChange={(e) => updateScheduleRow(d.dayOfWeek, { enabled: e.target.checked })}
                                className="mr-1"
                              />
                              {lang === 'ar' ? WEEK_DAYS[d.dayOfWeek].ar : WEEK_DAYS[d.dayOfWeek].en}
                            </label>
                            <Input
                              type="time"
                              value={d.start}
                              onChange={(e) => updateScheduleRow(d.dayOfWeek, { start: e.target.value })}
                              className="h-8 bg-slate-800 border-slate-600 text-white"
                              disabled={!d.enabled}
                            />
                            <Input
                              type="time"
                              value={d.end}
                              onChange={(e) => updateScheduleRow(d.dayOfWeek, { end: e.target.value })}
                              className="h-8 bg-slate-800 border-slate-600 text-white"
                              disabled={!d.enabled}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                    <Button size="sm" onClick={() => handleUpdate(s._id)} disabled={adding}>{t('Save', 'حفظ')}</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>{t('Cancel', 'إلغاء')}</Button>
                  </>
                ) : (
                  <>
                    <span className="text-sm text-slate-400">{roleLabel(s.role)}</span>
                    <span className="text-xs text-slate-500">{statusLabel(s.status)}</span>
                    <div className="w-full flex flex-wrap gap-1">
                      {effectiveRolePermissions(s.role, s.permissions).map((p) => (
                        <span key={p} className="text-[10px] rounded-full border border-slate-700 px-2 py-0.5 text-slate-300">
                          {permissionLabel(p)}
                        </span>
                      ))}
                    </div>
                    {!s.isOwnerOrCoOwner && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingId(s._id)
                            setEditDisplayName(s.displayName || '')
                            setEditRole(s.role)
                            setEditStatus((s.status || 'active') as 'active' | 'suspended' | 'archived')
                            setEditPhone(s.phone || '')
                            setEditWhatsappPhone(s.whatsappPhone || '')
                            setEditPermissions(s.permissions)
                            setEditReceiveFcm(s.notificationRules?.receiveFcm !== false)
                            setEditReceiveWhatsapp(s.notificationRules?.receiveWhatsapp === true)
                            setEditNotifyNewOrder(s.notificationRules?.newOrder !== false)
                            setEditNotifyUnaccepted(s.notificationRules?.unacceptedOrderReminder !== false)
                            setEditTimezone(s.workSchedule?.timezone || 'Asia/Jerusalem')
                            setEditSchedule(hydrateWeekSchedule(s.workSchedule))
                          }}
                          disabled={adding}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300" onClick={() => handleRemove(s._id)} disabled={adding}>
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
              onChange={(e) => setAddRole(e.target.value as (typeof ROLE_OPTIONS)[number])}
              className="h-10 w-full rounded-lg bg-slate-800 border border-slate-600 text-white px-3"
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>{roleLabel(r)}</option>
              ))}
            </select>
          </div>
          {addRole === 'custom' && (
            <div className="w-full rounded-lg border border-slate-700 p-3">
              <p className="text-xs text-slate-300 mb-2">{t('Custom permissions', 'صلاحيات مخصصة')}</p>
              <div className="flex flex-wrap gap-2">
                {MANAGEABLE_PERMISSIONS.map((p) => (
                  <label key={p} className="flex items-center gap-1 text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={addPermissions.includes(p)}
                      onChange={() => toggleAddPermission(p)}
                    />
                    {permissionLabel(p)}
                  </label>
                ))}
              </div>
            </div>
          )}
          {addRole !== 'custom' && (
            <div className="w-full flex flex-wrap gap-1">
              {effectiveRolePermissions(addRole, []).map((p) => (
                <span key={p} className="text-[10px] rounded-full border border-slate-700 px-2 py-0.5 text-slate-300">
                  {permissionLabel(p)}
                </span>
              ))}
            </div>
          )}
          <Button onClick={handleAdd} disabled={adding || !addEmail.trim()}>
            {adding ? t('Adding…', 'جاري الإضافة…') : t('Add', 'إضافة')}
          </Button>
        </div>
      </div>
    </div>
  )
}
