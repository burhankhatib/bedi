'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useLanguage } from '@/components/LanguageContext'
import { Truck, MessageCircle, ShieldCheck, ShieldAlert } from 'lucide-react'
import { getWhatsAppUrl } from '@/lib/whatsapp'
import { getDriverInviteMessageAr } from '@/lib/driver-invite'
import { toEnglishDigits } from '@/lib/phone'

import { EntityRatingBadge } from '@/components/rating/EntityRatingBadge'

const COUNTRY_CODES = [
  { value: '972', label: '+972' },
  { value: '970', label: '+970' },
]

type DriverInArea = {
  _id: string
  name: string
  nickname?: string
  phoneNumber: string
  vehicleType?: string
  vehicleNumber?: string
  isOnline?: boolean
  isVerifiedByAdmin?: boolean
  picture?: { asset?: { _ref: string } }
  rating?: { averageScore: number; totalCount: number } | null
}

export function DriversManageClient({
  slug,
  initialCountry,
  initialCity,
}: {
  slug: string
  initialCountry: string
  initialCity: string
}) {
  const [drivers, setDrivers] = useState<DriverInArea[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteName, setInviteName] = useState('')
  const [invitePhone, setInvitePhone] = useState('')
  const [driverFields, setDriverFields] = useState<Record<string, { name: string; countryCode: string; number: string }>>({})
  const { t, lang } = useLanguage()

  const getDriverFields = (d: DriverInArea) => {
    if (driverFields[d._id]) return driverFields[d._id]
    const raw = toEnglishDigits(d.phoneNumber || '').replace(/\D/g, '')
    const is970 = raw.startsWith('970') || raw.startsWith('00970')
    const code = is970 ? '970' : '972'
    let num = raw.replace(/^00970/, '').replace(/^970/, '').replace(/^00972/, '').replace(/^972/, '').replace(/^0+/, '')
    if (!num && raw.length >= 9) num = raw.startsWith('0') ? raw.slice(1) : raw
    const name = (d.nickname?.trim() || d.name).trim() || d.name
    return { name, countryCode: code, number: num }
  }
  const setDriverField = (driverId: string, field: 'name' | 'countryCode' | 'number', value: string) => {
    setDriverFields((prev) => {
      const current = prev[driverId] ?? { name: '', countryCode: '972', number: '' }
      return { ...prev, [driverId]: { ...current, [field]: value } }
    })
  }
  const buildFullPhone = (countryCode: string, number: string) => {
    const digits = toEnglishDigits(number).replace(/\D/g, '').replace(/^0+/, '')
    if (!digits) return ''
    return countryCode + digits
  }

  const api = (path: string, options?: RequestInit) =>
    fetch(`/api/tenants/${slug}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...options?.headers } })

  const fetchedSlugRef = useRef<string | null>(null)
  useEffect(() => {
    if (fetchedSlugRef.current === slug) return
    fetchedSlugRef.current = slug
    setLoading(true)
    api('/drivers')
      .then((r) => r.json())
      .then((data) => setDrivers(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false))
  }, [slug])

  const displayName = (d: DriverInArea) => (d.nickname?.trim() || d.name).trim() || d.name
  const hasCountryCity = Boolean(initialCountry && initialCity)

  const openInviteWhatsApp = (phone: string, driverName: string) => {
    const message = getDriverInviteMessageAr(driverName)
    const url = getWhatsAppUrl(phone, message)
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="mt-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold">{t('Captains (Drivers)', 'الكباتن (السائقون)')}</h1>
        <p className="mt-1 text-slate-400">
          {t(
            'Drivers in your area who have registered in the system. You cannot add drivers manually — invite them to register via WhatsApp.',
            'السائقون في منطقتك المسجلون في النظام. لا يمكنك إضافة سائقين يدوياً — ادعُهم للتسجيل عبر واتساب.'
          )}
        </p>
      </div>

      {/* Invite a driver: name + phone, then WhatsApp */}
      <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 p-4">
        <h2 className="mb-2 font-semibold text-white">{t('Invite a driver', 'ادعُ سائقاً للتسجيل')}</h2>
        <p className="mb-3 text-xs text-slate-500">
          {t(
            'Enter the driver\'s name and phone number, then click the button to send them a personalized WhatsApp invitation.',
            'أدخل اسم السائق ورقم هاتفه، ثم اضغط الزر لإرسال دعوة واتساب شخصية له.'
          )}
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[140px]">
            <label className="mb-1 block text-xs font-medium text-slate-400">{t('Name', 'الاسم')}</label>
            <Input
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              placeholder={t('Driver name', 'اسم السائق')}
              className="h-10 bg-slate-800 border-slate-600 text-white"
            />
          </div>
          <div className="min-w-[160px]">
            <label className="mb-1 block text-xs font-medium text-slate-400">{t('Phone (WhatsApp)', 'رقم الواتساب')}</label>
            <Input
              value={invitePhone}
              onChange={(e) => setInvitePhone(e.target.value)}
              placeholder="+972501234567"
              className="h-10 bg-slate-800 border-slate-600 text-white"
            />
          </div>
          <Button
            type="button"
            size="sm"
            className="h-10 bg-[#25D366] text-white hover:bg-[#20bd5a]"
            onClick={() => openInviteWhatsApp(invitePhone, inviteName)}
            disabled={!invitePhone.trim()}
          >
            <MessageCircle className="mr-2 size-4" />
            {t('Send WhatsApp invite', 'إرسال دعوة واتساب')}
          </Button>
        </div>
      </div>

      {/* Drivers in your area */}
      <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 p-4">
        <h2 className="mb-3 font-semibold text-white">
          {hasCountryCity
            ? t('Drivers in your area', 'السائقون في منطقتك')
            : t('Drivers in your area', 'السائقون في منطقتك')}
          {hasCountryCity && (
            <span className="ml-2 text-sm font-normal text-slate-400">
              ({initialCity})
            </span>
          )}
        </h2>
        {!hasCountryCity ? (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-200/90">
            {t(
              'Set your business Country & City in Manage Business to see drivers in your area.',
              'حدّث بلد ومدينة عملك في إدارة العمل لرؤية السائقين في منطقتك.'
            )}
          </p>
        ) : loading ? (
          <p className="text-slate-500">{t('Loading…', 'جاري التحميل…')}</p>
        ) : drivers.length === 0 ? (
          <p className="text-slate-500">
            {t(
              'No drivers have registered in your city yet. Use "Send WhatsApp invite" to invite drivers to register.',
              'لم يسجّل أي سائق في مدينتك بعد. استخدم «إرسال دعوة واتساب» لتدعوة سائقين للتسجيل.'
            )}
          </p>
        ) : (
          <ul className="space-y-3">
            {drivers.map((d) => {
              const fields = getDriverFields(d)
              const fullPhone = buildFullPhone(fields.countryCode, fields.number)
              const canWhatsApp = fields.name.trim() !== '' && fullPhone !== ''
              const openDriverWhatsApp = () => {
                const message = getDriverInviteMessageAr(fields.name.trim())
                const url = getWhatsAppUrl(fullPhone, message)
                if (url) window.open(url, '_blank', 'noopener,noreferrer')
              }
              return (
                <li
                  key={d._id}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-700/50 bg-slate-800/30 p-4"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <Truck className="size-5 shrink-0 text-amber-400" />
                    <span className="font-semibold text-white flex items-center gap-1.5">
                      {displayName(d)}
                      {d.isVerifiedByAdmin ? (
                        <div title={t('Verified Driver', 'سائق موثّق')}>
                          <ShieldCheck className="size-4 text-blue-500" />
                        </div>
                      ) : (
                        <div title={t('Under Review', 'قيد المراجعة')}>
                          <ShieldAlert className="size-4 text-slate-500" />
                        </div>
                      )}
                    </span>
                    {d.rating && d.rating.totalCount > 0 && (
                      <EntityRatingBadge averageScore={d.rating.averageScore} totalCount={d.rating.totalCount} size="sm" />
                    )}
                    {d.nickname && d.nickname !== d.name && (
                      <span className="text-xs text-slate-500">({d.name})</span>
                    )}
                    {d.isOnline && (
                      <span className="rounded bg-emerald-600/40 px-2 py-0.5 text-xs text-emerald-300">
                        {t('Online', 'متصل')}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-end gap-2 ml-auto">
                    <div className="min-w-[120px]">
                      <label className="mb-1 block text-xs font-medium text-slate-400">{t('Name', 'الاسم')}</label>
                      <Input
                        value={fields.name}
                        onChange={(e) => setDriverField(d._id, 'name', e.target.value)}
                        placeholder={t('Driver name', 'اسم السائق')}
                        className="h-9 bg-slate-800 border-slate-600 text-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-400">{t('Code', 'المفتاح')}</label>
                      <select
                        value={fields.countryCode}
                        onChange={(e) => setDriverField(d._id, 'countryCode', e.target.value)}
                        className="h-9 rounded-md border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                      >
                        {COUNTRY_CODES.map((c) => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="min-w-[130px]">
                      <label className="mb-1 block text-xs font-medium text-slate-400">{t('Phone', 'رقم الهاتف')}</label>
                      <Input
                        value={fields.number}
                        onChange={(e) => setDriverField(d._id, 'number', e.target.value)}
                        placeholder="501234567"
                        className="h-9 bg-slate-800 border-slate-600 text-white text-sm"
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      className="h-9 bg-[#25D366] text-white hover:bg-[#20bd5a] disabled:opacity-50 disabled:pointer-events-none"
                      onClick={openDriverWhatsApp}
                      disabled={!canWhatsApp}
                      title={canWhatsApp ? t('Send WhatsApp message', 'إرسال رسالة واتساب') : t('Fill name and phone first', 'أدخل الاسم والرقم أولاً')}
                    >
                      <MessageCircle className="mr-1.5 size-4" />
                      {t('WhatsApp', 'واتساب')}
                    </Button>
                  </div>
                  {(d.vehicleType || d.vehicleNumber) && (
                    <div className="w-full flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1 pt-2 border-t border-slate-700/50">
                      {d.vehicleType && (
                        <span className="rounded bg-slate-700 px-2 py-0.5 capitalize text-slate-300">{d.vehicleType}</span>
                      )}
                      {d.vehicleNumber && (
                        <span className="rounded bg-slate-700/50 px-2 py-0.5 text-slate-400">{d.vehicleNumber}</span>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
