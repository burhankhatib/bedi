'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLanguage } from '@/components/LanguageContext'
import { useToast } from '@/components/ui/ToastProvider'
import { Button } from '@/components/ui/button'
import { Clock3, LogIn, LogOut } from 'lucide-react'

type AttendanceSession = {
  _id: string
  actorEmail?: string
  actorRole?: string
  status?: 'open' | 'closed'
  clockInAt?: string
  clockOutAt?: string
  totalMinutes?: number
  clockOutMethod?: string
  staffId?: string
  staffName?: string
  staffEmail?: string
}

async function getCurrentPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocation is not available on this device'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(new Error(err.message || 'Location permission denied')),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 10000 }
    )
  })
}

export function AttendanceManageClient({
  slug,
  canManageStaff,
}: {
  slug: string
  canManageStaff: boolean
}) {
  const { t, lang } = useLanguage()
  const { showToast } = useToast()
  const [mine, setMine] = useState<AttendanceSession[]>([])
  const [team, setTeam] = useState<AttendanceSession[]>([])
  const [loading, setLoading] = useState(true)
  const [clocking, setClocking] = useState(false)
  const [forceClosingId, setForceClosingId] = useState<string | null>(null)

  const api = useCallback(
    (path: string, init?: RequestInit) =>
      fetch(`/api/tenants/${slug}${path}`, {
        ...init,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
      }),
    [slug]
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const mineRes = await api('/attendance?mine=1&limit=20')
      const mineData = mineRes.ok ? await mineRes.json() : { sessions: [] }
      setMine(Array.isArray(mineData?.sessions) ? mineData.sessions : [])

      if (canManageStaff) {
        const teamRes = await api('/attendance?limit=60')
        const teamData = teamRes.ok ? await teamRes.json() : { sessions: [] }
        setTeam(Array.isArray(teamData?.sessions) ? teamData.sessions : [])
      } else {
        setTeam([])
      }
    } finally {
      setLoading(false)
    }
  }, [api, canManageStaff])

  useEffect(() => {
    load().catch(() => {})
  }, [load])

  const openMySession = useMemo(
    () => mine.find((s) => s.status === 'open'),
    [mine]
  )

  const handleClockIn = async () => {
    setClocking(true)
    try {
      const pos = await getCurrentPosition()
      const res = await api('/attendance/clock-in', {
        method: 'POST',
        body: JSON.stringify(pos),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(
          data?.error || 'Clock-in failed',
          data?.error || 'فشل تسجيل الحضور',
          'error'
        )
        return
      }
      showToast('Clock-in successful', 'تم تسجيل الحضور بنجاح', 'success')
      await load()
    } catch (e) {
      showToast(
        e instanceof Error ? e.message : 'Clock-in failed',
        e instanceof Error ? e.message : 'فشل تسجيل الحضور',
        'error'
      )
    } finally {
      setClocking(false)
    }
  }

  const handleClockOut = async () => {
    setClocking(true)
    try {
      const pos = await getCurrentPosition().catch(() => null)
      const res = await api('/attendance/clock-out', {
        method: 'POST',
        body: JSON.stringify(pos ?? {}),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(
          data?.error || 'Clock-out failed',
          data?.error || 'فشل تسجيل الانصراف',
          'error'
        )
        return
      }
      showToast('Clock-out successful', 'تم تسجيل الانصراف بنجاح', 'success')
      await load()
    } finally {
      setClocking(false)
    }
  }

  const handleManagerForceClockOut = async (staffId: string) => {
    if (!staffId) return
    setForceClosingId(staffId)
    try {
      const res = await api(`/attendance/clock-out/${staffId}`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Manager closed open session' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(
          data?.error || 'Failed to close session',
          data?.error || 'فشل إنهاء الجلسة',
          'error'
        )
        return
      }
      showToast('Session closed', 'تم إنهاء الجلسة', 'success')
      await load()
    } finally {
      setForceClosingId(null)
    }
  }

  const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US') : '—')

  return (
    <div className="mt-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Clock3 className="size-6" />
          {t('Attendance', 'الحضور')}
        </h1>
        <p className="mt-1 text-slate-400">
          {t(
            'Clock in/out requires location. Clock-in works only within 50 meters of your business location.',
            'تسجيل الحضور والانصراف يحتاج الموقع. الحضور مسموح فقط داخل 50 متر من موقع النشاط.'
          )}
        </p>
      </div>

      <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 p-4">
        <p className="text-sm text-slate-300 mb-3">
          {openMySession
            ? t('You are currently clocked in.', 'أنت مسجل حضور حالياً.')
            : t('You are currently clocked out.', 'أنت مسجل انصراف حالياً.')}
        </p>
        <div className="flex gap-2">
          <Button
            onClick={handleClockIn}
            disabled={clocking || !!openMySession}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <LogIn className="size-4 mr-2" />
            {t('Clock In', 'تسجيل حضور')}
          </Button>
          <Button
            onClick={handleClockOut}
            disabled={clocking || !openMySession}
            className="bg-amber-500 text-slate-950 hover:bg-amber-400"
          >
            <LogOut className="size-4 mr-2" />
            {t('Clock Out', 'تسجيل انصراف')}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800/60 bg-slate-900/40">
        <div className="p-4 border-b border-slate-800/60 font-semibold text-white">
          {t('My Recent Sessions', 'جلساتي الأخيرة')}
        </div>
        {loading ? (
          <div className="p-4 text-slate-400">{t('Loading…', 'جاري التحميل…')}</div>
        ) : mine.length === 0 ? (
          <div className="p-4 text-slate-400">{t('No sessions yet.', 'لا توجد جلسات بعد.')}</div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {mine.map((s) => (
              <div key={s._id} className="p-4 text-sm flex flex-wrap gap-3 items-center justify-between">
                <div className="space-y-1">
                  <p className="text-slate-200">
                    {t('In', 'دخول')}: {fmt(s.clockInAt)} {s.status === 'open' ? `(${t('Open', 'مفتوح')})` : ''}
                  </p>
                  <p className="text-slate-400">
                    {t('Out', 'خروج')}: {fmt(s.clockOutAt)} · {t('Minutes', 'دقائق')}: {s.totalMinutes ?? '—'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {canManageStaff && (
        <div className="rounded-xl border border-slate-800/60 bg-slate-900/40">
          <div className="p-4 border-b border-slate-800/60 font-semibold text-white">
            {t('Team Sessions', 'جلسات الفريق')}
          </div>
          {loading ? (
            <div className="p-4 text-slate-400">{t('Loading…', 'جاري التحميل…')}</div>
          ) : team.length === 0 ? (
            <div className="p-4 text-slate-400">{t('No sessions yet.', 'لا توجد جلسات بعد.')}</div>
          ) : (
            <div className="divide-y divide-slate-800/60">
              {team.map((s) => (
                <div key={s._id} className="p-4 text-sm flex flex-wrap gap-3 items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-slate-200">
                      {(s.staffName || s.actorEmail || '—')} · {(s.actorRole || '—')}
                    </p>
                    <p className="text-slate-400">
                      {t('In', 'دخول')}: {fmt(s.clockInAt)} · {t('Out', 'خروج')}: {fmt(s.clockOutAt)}
                    </p>
                  </div>
                  {s.status === 'open' && s.staffId && (
                    <Button
                      size="sm"
                      onClick={() => handleManagerForceClockOut(s.staffId!)}
                      disabled={forceClosingId === s.staffId}
                      className="bg-slate-800 text-white hover:bg-slate-700"
                    >
                      {forceClosingId === s.staffId
                        ? t('Closing…', 'جاري الإنهاء…')
                        : t('Force Clock Out', 'إنهاء إجباري')}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

