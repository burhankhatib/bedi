'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/ToastProvider'
import { useLanguage } from '@/components/LanguageContext'
import { toEnglishDigits } from '@/lib/phone'
import { getCountryNameAr, getCityNameAr } from '@/lib/registration-translations'
import { detectCityAndCountry } from '@/lib/geofencing-utils'
import { Truck, Upload, ImageIcon, Trash2, AlertTriangle, LocateFixed } from 'lucide-react'

const VEHICLE_OPTIONS = [
  { value: '', label: '—', labelAr: '—' },
  { value: 'car', label: 'Car', labelAr: 'سيارة' },
  { value: 'motorcycle', label: 'Motorcycle', labelAr: 'دراجة نارية' },
  { value: 'bicycle', label: 'Bicycle', labelAr: 'دراجة' },
  { value: 'scooter', label: 'Scooter', labelAr: 'سكوتر' },
]

const GENDER_OPTIONS = [
  { value: '', label: '—', labelAr: '—' },
  { value: 'male', label: 'Male', labelAr: 'ذكر' },
  { value: 'female', label: 'Female', labelAr: 'أنثى' },
]

export function DriverProfileClient() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [pictureUploading, setPictureUploading] = useState(false)
  const pictureInputRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState({
    name: '',
    nickname: '',
    age: '' as string | number,
    phoneNumber: '',
    country: '',
    city: '',
    vehicleType: '',
    vehicleNumber: '',
    gender: '',
    rulesAcknowledged: false,
    receiveOfflineWhatsapp: true,
  })
  const [pictureAssetId, setPictureAssetId] = useState('')
  const [picturePreviewUrl, setPicturePreviewUrl] = useState<string | null>(null)
  const [countries, setCountries] = useState<Array<{ code: string; name: string }>>([])
  const [cities, setCities] = useState<string[]>([])
  const [isNewRegistration, setIsNewRegistration] = useState(false)
  const [deleteConfirming, setDeleteConfirming] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [phoneVerified, setPhoneVerified] = useState(false)
  const [detectingLocation, setDetectingLocation] = useState(false)
  const [recommendations, setRecommendations] = useState<{
    recommendedBy?: { name: string; phoneNumber: string }
    recommendedDrivers?: Array<{ name: string; phoneNumber: string; createdAt: string }>
  } | null>(null)
  const { showToast } = useToast()
  const { t, lang } = useLanguage()

  const searchParams = useSearchParams()

  useEffect(() => {
    fetch('/api/countries?registration=1')
      .then((r) => r.json())
      .then((list) => setCountries(Array.isArray(list) ? list : []))
      .catch(() => setCountries([]))
  }, [])

  useEffect(() => {
    if (!form.country) {
      setCities([])
      return
    }
    const params = new URLSearchParams({ country: form.country })
    fetch(`/api/cities?${params}`)
      .then((r) => r.json())
      .then((list) => setCities(Array.isArray(list) ? list : []))
      .catch(() => setCities([]))
  }, [form.country])

  useEffect(() => {
    setLoading(true)
    fetch('/api/driver/profile')
      .then((r) => {
        if (r.status === 403) {
          window.location.href = '/suspended?type=driver'
          return null
        }
        return r.json()
      })
      .then((data) => {
        if (data === null) return
        if (data?._id) {
          setIsNewRegistration(false)
          setPhoneVerified(data.phoneVerified === true)
          setForm({
            name: data.name ?? '',
            nickname: data.nickname ?? '',
            age: data.age ?? '',
            phoneNumber: data.phoneNumber ?? '',
            country: data.country ?? '',
            city: data.city ?? '',
            vehicleType: data.vehicleType ?? '',
            vehicleNumber: data.vehicleNumber ?? '',
            gender: data.gender ?? '',
            rulesAcknowledged: data.rulesAcknowledged ?? true,
            receiveOfflineWhatsapp: data.receiveOfflineWhatsapp ?? true,
          })
          setRecommendations({
            recommendedBy: data.recommendedBy,
            recommendedDrivers: data.recommendedDrivers,
          })
          setPicturePreviewUrl(data.pictureUrl || null)
          if (data.picture?.asset?._ref) setPictureAssetId(data.picture.asset._ref)
        } else {
          setIsNewRegistration(true)
          if (data.phoneVerified) {
            setPhoneVerified(true)
            if (data.phoneNumber) {
              setForm(f => ({ ...f, phoneNumber: data.phoneNumber }))
            }
          }
        }
      })
      .finally(() => setLoading(false))

    // Auto-detect location for new registrations (when country/city are empty)
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const result = detectCityAndCountry(pos.coords.longitude, pos.coords.latitude)
          if (result) {
            setForm((f) => {
              if (f.country && f.city) return f // don't overwrite if already set
              return { ...f, country: f.country || result.countryCode, city: f.city || result.city }
            })
          }
        },
        () => {}, // silently ignore — not a hard requirement
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
      )
    }
  }, [])

  const handlePictureChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    setPictureUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/driver/upload', { method: 'POST', body: fd })
      if (!res.ok) throw new Error('Upload failed')
      const { _id } = await res.json()
      setPictureAssetId(_id)
      setPicturePreviewUrl(URL.createObjectURL(file))
    } catch {
      showToast(t('Failed to upload picture.', 'فشل رفع الصورة.'), '', 'error')
    } finally {
      setPictureUploading(false)
      if (pictureInputRef.current) pictureInputRef.current.value = ''
    }
  }

  const handleDeleteProfile = async () => {
    setDeleteLoading(true)
    try {
      const res = await fetch('/api/driver/profile', { method: 'DELETE' })
      if (res.ok) {
        showToast(t('Profile deleted permanently.', 'تم حذف الملف نهائياً.'), '', 'success')
        window.location.href = '/' // redirect to home
      } else {
        const data = await res.json().catch(() => ({}))
        showToast(data?.error || t('Failed to delete profile.', 'فشل حذف الملف.'), '', 'error')
      }
    } catch {
      showToast(t('Failed to delete profile.', 'فشل حذف الملف.'), '', 'error')
    } finally {
      setDeleteLoading(false)
      setDeleteConfirming(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.phoneNumber.trim()) return
    if (isNewRegistration && !form.rulesAcknowledged) {
      showToast(
        t('You must acknowledge the rules to register.', 'يجب الموافقة على القواعد للتسجيل.'),
        '',
        'error'
      )
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/driver/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          nickname: form.nickname.trim() || undefined,
          age: form.age === '' ? undefined : (typeof form.age === 'number' ? form.age : parseInt(String(form.age), 10)),
          phoneNumber: form.phoneNumber.replace(/\s/g, ''),
          country: form.country || undefined,
          city: form.city || undefined,
          vehicleType: form.vehicleType || undefined,
          vehicleNumber: form.vehicleNumber.trim() || undefined,
          gender: form.gender || undefined,
          pictureAssetId: pictureAssetId || undefined,
          rulesAcknowledged: form.rulesAcknowledged,
          receiveOfflineWhatsapp: form.receiveOfflineWhatsapp,
          recommendedByCode: searchParams?.get('ref') || undefined,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        if (data?.city) setForm((f) => ({ ...f, city: data.city }))
        if (data?.claimedPlaceholder) {
          showToast(
            t('You’ve linked your account to businesses that added this number. You now control this profile and can receive orders.', 'تم ربط حسابك بالشركات التي أضافت هذا الرقم. أنت تتحكم بهذا الملف الآن ويمكنك استقبال الطلبات.'),
            '',
            'success'
          )
        } else {
          showToast(
            t('Profile saved. Turn on notifications and go online to receive orders.', 'تم حفظ الملف. فعّل الإشعارات واختر «متصل» لاستقبال الطلبات.'),
            '',
            'success'
          )
        }
        // Re-fetch server layout so it sees the new driver doc before showing orders (avoids redirect loop)
        // router.refresh() // Removed to prevent React Error #310 race condition with window.location.href
        const phoneTrimmed = form.phoneNumber.replace(/\s/g, '').trim()
        if (phoneTrimmed && !phoneVerified) {
          const digits = toEnglishDigits(phoneTrimmed).replace(/\D/g, '')
          const countryCode = digits.startsWith('970') ? '+970' : '+972'
          const e164 =
            digits.startsWith('970') || digits.startsWith('972')
              ? '+' + digits
              : digits.startsWith('0') && digits.length >= 10
                ? '+972' + digits.slice(1)
                : countryCode + digits.replace(/^0+/, '')
          const params = new URLSearchParams({
            returnTo: isNewRegistration ? '/driver/orders?registered=1' : '/driver/profile',
            phone: e164.startsWith('+') ? e164 : '+' + e164,
          })
          params.set('countryCode', countryCode)
          window.location.href = `/verify-phone?${params.toString()}`
        } else {
          if (isNewRegistration) {
            window.location.href = '/driver/orders?registered=1'
          } else {
            window.location.href = '/driver/profile'
          }
        }
      } else {
        showToast(data?.error || t('Failed to save.', 'فشل الحفظ.'), '', 'error')
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-slate-500">{t('Loading…', 'جاري التحميل…')}</p>

  const vehicleLabel = (v: { value: string; label: string; labelAr: string }) => (lang === 'ar' ? v.labelAr : v.label)

  return (
    <div className="max-w-xl rounded-xl border border-slate-800/60 bg-slate-900/40 p-4 sm:p-6">
      <div className="mb-4 flex items-center gap-2">
        <Truck className="size-6 shrink-0 text-amber-400" />
        <h1 className="text-xl font-bold">
          {isNewRegistration
            ? t('Welcome! Complete your profile', 'مرحباً! أكمل ملفك الشخصي')
            : t('Your driver profile', 'ملف السائق')}
        </h1>
      </div>
      <p className="mb-6 text-base text-slate-400">
        {isNewRegistration
          ? t(
              'Step 1: Fill in your details below and save. You need to complete this before you can receive orders. After saving, you’ll go to the Orders page where you can enable notifications and go online.',
              'الخطوة ١: أكمِل بياناتك أدناه واحفظ. تحتاج إكمال هذا قبل استقبال الطلبات. بعد الحفظ ستنتقل لصفحة الطلبات حيث يمكنك تفعيل الإشعارات والدخول متصلاً.'
            )
          : t(
              'Complete your details. Businesses in your area will see you and can assign you delivery orders.',
              'أكمل بياناتك. الشركات في منطقتك ستراك ويمكنها تعيين طلبات التوصيل لك.'
            )}
      </p>
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Rules & privacy — visible at top so drivers cannot miss it */}
        {(isNewRegistration || !form.rulesAcknowledged) && (
          <div className="rounded-xl border-2 border-amber-500/40 bg-amber-500/10 p-4 ring-2 ring-amber-500/20">
            <label className="flex cursor-pointer items-start gap-4 text-slate-200">
              <input
                type="checkbox"
                checked={form.rulesAcknowledged}
                onChange={(e) => setForm((f) => ({ ...f, rulesAcknowledged: e.target.checked }))}
                className="mt-1 size-6 min-h-6 min-w-6 shrink-0 cursor-pointer rounded border-2 border-amber-400/60 bg-slate-800 text-amber-500 accent-amber-500 focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-slate-900"
                aria-describedby="driver-rules-desc"
              />
              <span id="driver-rules-desc" className="text-base leading-relaxed">
                {t('I have read and agree to the rules and ', 'لقد قرأت وأوافق على قواعد و ')}
                <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="underline text-amber-300 hover:text-amber-200">
                  {t('Privacy Policy', 'سياسة الخصوصية')}
                </Link>
                {t(' of this website. I acknowledge that I will comply with them as a delivery driver.', ' لهذا الموقع. أقر بأنني سألتزم بها كسائق توصيل.')}
              </span>
            </label>
            {isNewRegistration && (
              <p className="mt-2 text-sm text-amber-200/80">
                {t('You must check this box to complete your profile.', 'يجب تحديد هذا المربع لإكمال ملفك الشخصي.')}
              </p>
            )}
          </div>
        )}
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-400">{t('Full name', 'الاسم الكامل')} *</label>
          <Input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="min-h-[48px] bg-slate-800 border-slate-600 text-base text-white"
            required
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-400">{t('Preferred nickname', 'اللقب المفضل')}</label>
          <Input
            value={form.nickname}
            onChange={(e) => setForm((f) => ({ ...f, nickname: e.target.value }))}
            placeholder={t('How you want to be shown (e.g. on orders)', 'كيف تريد أن يظهر اسمك (مثلاً على الطلبات)')}
            className="min-h-[48px] bg-slate-800 border-slate-600 text-base text-white"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-400">{t('Age', 'العمر')}</label>
          <Input
            type="number"
            min={18}
            max={120}
            value={form.age}
            onChange={(e) => setForm((f) => ({ ...f, age: e.target.value }))}
            placeholder="18+"
            className="min-h-[48px] bg-slate-800 border-slate-600 text-base text-white"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-400">{t('Personal picture', 'الصورة الشخصية')}</label>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex size-24 items-center justify-center overflow-hidden rounded-xl border border-slate-600 bg-slate-800/50">
              {picturePreviewUrl ? (
                <img src={picturePreviewUrl} alt="" className="size-full object-cover" />
              ) : (
                <ImageIcon className="size-10 text-slate-500" />
              )}
            </div>
            <div className="flex flex-col gap-2">
              <input
                ref={pictureInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handlePictureChange}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700"
                onClick={() => pictureInputRef.current?.click()}
                disabled={pictureUploading}
              >
                <Upload className="mr-2 size-4" />
                {pictureUploading ? t('Uploading…', 'جاري الرفع…') : picturePreviewUrl ? t('Change picture', 'تغيير الصورة') : t('Upload picture', 'رفع صورة')}
              </Button>
            </div>
          </div>
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-400">{t('Gender', 'الجنس')}</label>
          <select
            value={form.gender}
            onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}
            className="min-h-[48px] w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-3 text-base text-white"
          >
            {GENDER_OPTIONS.map((o) => (
              <option key={o.value || 'none'} value={o.value}>
                {vehicleLabel(o)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-2 flex items-center justify-between text-sm font-medium text-slate-400">
            <span>{t('WhatsApp / phone', 'واتساب / الهاتف')} *</span>
            {phoneVerified && (
              <a href={`/verify-phone?returnTo=/driver/profile&intent=change`} className="text-xs text-amber-500 hover:text-amber-400">
                {t('Change & Verify', 'تغيير وتأكيد')}
              </a>
            )}
          </label>
          <Input
            value={form.phoneNumber}
            onChange={(e) => {
              if (phoneVerified) return
              setForm((f) => ({ ...f, phoneNumber: toEnglishDigits(e.target.value) }))
            }}
            placeholder="+972501234567"
            className={`min-h-[48px] bg-slate-800 border-slate-600 text-base text-white ${phoneVerified ? 'opacity-70 cursor-not-allowed' : ''}`}
            required
            readOnly={phoneVerified}
          />
          {phoneVerified ? (
            <p className="mt-1 text-xs text-slate-500">{t('Verified phone number.', 'رقم الهاتف مؤكد.')}</p>
          ) : (
            <p className="mt-1 text-xs text-amber-500/80">{t('You will be asked to verify this number after saving.', 'سيُطلب منك تأكيد هذا الرقم بعد الحفظ.')}</p>
          )}
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-400">{t('Country', 'البلد')}</label>
          <select
            value={form.country}
            onChange={(e) => setForm((f) => ({ ...f, country: e.target.value, city: '' }))}
            className="min-h-[48px] w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-3 text-base text-white"
          >
            <option value="">{t('Select country', 'اختر البلد')}</option>
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {lang === 'ar' ? (getCountryNameAr(c.code) ?? c.name) : c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-400">{t('City', 'المدينة')}</label>
          <select
            value={form.city}
            onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
            className="min-h-[48px] w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-3 text-base text-white"
          >
            <option value="">{t('Select city', 'اختر المدينة')}</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {lang === 'ar' ? (getCityNameAr(c) ?? c) : c}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={detectingLocation}
            className="mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-amber-400 hover:bg-slate-800 transition-colors disabled:opacity-50"
            onClick={() => {
              if (!navigator.geolocation) {
                showToast(t('Location not supported.', 'الموقع غير مدعوم.'), '', 'error')
                return
              }
              setDetectingLocation(true)
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  const result = detectCityAndCountry(pos.coords.longitude, pos.coords.latitude)
                  setDetectingLocation(false)
                  if (result) {
                    setForm((f) => ({ ...f, country: result.countryCode, city: result.city }))
                    showToast(t(`Detected: ${result.city}`, `تم الكشف: ${result.city}`), '', 'success')
                  } else {
                    showToast(t('Could not detect your city. Please select manually.', 'تعذر الكشف عن مدينتك. يرجى الاختيار يدوياً.'), '', 'error')
                  }
                },
                () => {
                  setDetectingLocation(false)
                  showToast(t('Location access denied. Enable it in settings.', 'تم رفض الوصول للموقع. فعّله من الإعدادات.'), '', 'error')
                },
                { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
              )
            }}
          >
            <LocateFixed className={`size-4 ${detectingLocation ? 'animate-pulse' : ''}`} />
            {detectingLocation ? t('Detecting…', 'جاري الكشف…') : t('Detect from GPS', 'كشف من الموقع')}
          </button>
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-400">{t('Vehicle type', 'نوع المركبة')}</label>
          <select
            value={form.vehicleType}
            onChange={(e) => setForm((f) => ({ ...f, vehicleType: e.target.value }))}
            className="min-h-[48px] w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-3 text-base text-white"
          >
            {VEHICLE_OPTIONS.map((o) => (
              <option key={o.value || 'none'} value={o.value}>
                {vehicleLabel(o)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-400">{t('Vehicle number (if applicable)', 'رقم المركبة (إن وجد)')}</label>
          <Input
            value={form.vehicleNumber}
            onChange={(e) => setForm((f) => ({ ...f, vehicleNumber: e.target.value }))}
            placeholder={t('e.g. license plate', 'مثلاً لوحة الترخيص')}
            className="min-h-[48px] bg-slate-800 border-slate-600 text-base text-white"
          />
        </div>
        <div className="rounded-xl border border-slate-800/60 bg-slate-900/50 p-4 mb-4">
          <label className="flex cursor-pointer items-start gap-4">
            <input
              type="checkbox"
              checked={form.receiveOfflineWhatsapp}
              onChange={(e) => setForm((f) => ({ ...f, receiveOfflineWhatsapp: e.target.checked }))}
              className="mt-1 size-5 shrink-0 cursor-pointer rounded border-slate-600 bg-slate-800 text-amber-500 accent-amber-500 focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-slate-900"
            />
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-slate-200">
                {t('Receive WhatsApp notifications when offline', 'تلقي إشعارات واتساب عند عدم الاتصال')}
              </span>
              <span className="text-xs text-slate-400 leading-relaxed">
                {t('Get notified about unassigned orders in your city even when you are offline. (Max once every 3 hours)', 'احصل على إشعارات حول الطلبات غير المعينة في مدينتك حتى عند عدم اتصالك. (مرة واحدة كل 3 ساعات كحد أقصى)')}
              </span>
            </div>
          </label>
        </div>
        <Button
          type="submit"
          size="lg"
          className="min-h-[48px] w-full touch-manipulation bg-amber-500 text-base text-slate-950 hover:bg-amber-400 active:bg-amber-300"
          disabled={saving || (isNewRegistration && !form.rulesAcknowledged)}
        >
          {saving ? t('Saving…', 'جاري الحفظ…') : isNewRegistration ? t('Save and continue', 'حفظ ومتابعة') : t('Save profile', 'حفظ الملف')}
        </Button>
        {isNewRegistration && (
          <p className="text-center text-sm text-slate-500 mt-2">
            {t('After saving you’ll go to Orders to enable notifications and start receiving orders.', 'بعد الحفظ ستنتقل إلى الطلبات لتفعيل الإشعارات وبدء استقبال الطلبات.')}
          </p>
        )}
      </form>

      {!isNewRegistration && recommendations && (
        <div className="mt-8 border-t border-slate-800 pt-6">
          <h3 className="text-lg font-semibold text-slate-200 mb-4">
            {t('Recommendations', 'التوصيات')}
          </h3>
          <div className="space-y-4">
            {recommendations.recommendedBy && (
              <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
                <p className="text-xs font-medium text-slate-400 mb-1">{t('You were invited by', 'تمت دعوتك بواسطة')}</p>
                <div className="text-sm font-medium text-white">
                  {recommendations.recommendedBy.name}
                  {recommendations.recommendedBy.phoneNumber && <span className="text-slate-400 ml-2 block sm:inline" dir="ltr">{recommendations.recommendedBy.phoneNumber}</span>}
                </div>
              </div>
            )}
            
            <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
              <p className="text-xs font-medium text-slate-400 mb-2">
                {t('Drivers you invited', 'السائقون الذين دعوتهم')} ({recommendations.recommendedDrivers?.length || 0})
              </p>
              {recommendations.recommendedDrivers && recommendations.recommendedDrivers.length > 0 ? (
                <ul className="space-y-2 divide-y divide-slate-700/50">
                  {recommendations.recommendedDrivers.map((rd, i) => (
                    <li key={i} className="pt-2 first:pt-0">
                      <div className="flex justify-between items-center text-sm">
                        <span className="font-medium text-white">{rd.name}</span>
                        <span className="text-slate-400 text-xs" dir="ltr">{new Date(rd.createdAt).toLocaleDateString()}</span>
                      </div>
                      {rd.phoneNumber && <p className="text-xs text-slate-400 mt-0.5" dir="ltr">{rd.phoneNumber}</p>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">{t('You haven’t invited anyone yet.', 'لم تقم بدعوة أحد بعد.')}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {!isNewRegistration && (
        <div className="mt-8 border-t border-rose-900/30 pt-6">
          <h3 className="text-lg font-semibold text-rose-500 mb-2">
            {t('Danger Zone', 'منطقة الخطر')}
          </h3>
          <p className="text-sm text-slate-400 mb-4">
            {t('Permanently delete your profile. This action cannot be undone. All your active orders will be automatically reassigned.', 'حذف ملفك الشخصي نهائياً. لا يمكن التراجع عن هذا الإجراء. سيتم إعادة تعيين جميع طلباتك النشطة تلقائياً.')}
          </p>

          {deleteConfirming ? (
            <div className="rounded-xl border border-rose-600/40 bg-rose-950/30 p-4">
              <div className="flex items-start gap-3 mb-4">
                <AlertTriangle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
                <p className="text-sm text-rose-200">
                  {t('Are you absolutely sure you want to delete your profile? All data will be lost.', 'هل أنت متأكد تماماً أنك تريد حذف ملفك الشخصي؟ سيتم فقدان جميع البيانات.')}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  onClick={handleDeleteProfile}
                  disabled={deleteLoading}
                  className="bg-rose-600 text-white hover:bg-rose-700"
                >
                  {deleteLoading ? t('Deleting...', 'جاري الحذف...') : t('Yes, permanently delete', 'نعم، احذف نهائياً')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDeleteConfirming(false)}
                  disabled={deleteLoading}
                  className="border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  {t('Cancel', 'إلغاء')}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteConfirming(true)}
              className="border-rose-900/50 bg-rose-950/20 text-rose-400 hover:bg-rose-900/40 hover:text-rose-300"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {t('Permanently delete my profile', 'حذف ملفي الشخصي نهائياً')}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
