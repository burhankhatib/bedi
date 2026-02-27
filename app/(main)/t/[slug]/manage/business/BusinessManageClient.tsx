'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/ToastProvider'
import { useLanguage } from '@/components/LanguageContext'
import { BUSINESS_TYPES } from '@/lib/constants'
import { getCountryNameAr, getCityNameAr } from '@/lib/registration-translations'
import { toEnglishDigits } from '@/lib/phone'
import { Upload, ImageIcon, Volume2, Play, AlertTriangle, Trash2, Store, UtensilsCrossed, Clock, MapPin, Save } from 'lucide-react'
import { TenantQRCode } from '@/components/TenantQRCode'
import { useTenantBusiness } from '../TenantBusinessContext'

type CountryOption = { code: string; name: string }
type Subcategory = { _id: string; slug: string; title_en: string; title_ar: string; businessType: string }
type BusinessData = {
  tenant: {
    _id: string
    name: string
    country?: string
    city?: string
    businessType?: string
    businessSubcategoryIds?: string[]
    ownerPhone?: string
    deactivated?: boolean
    deactivateUntil?: string | null
    defaultLanguage?: string | null
    supportsDineIn?: boolean
    supportsReceiveInPerson?: boolean
    supportsDelivery?: boolean
  }
  restaurantInfo: {
    name_en?: string
    name_ar?: string
    tagline_en?: string
    tagline_ar?: string
    address_en?: string
    address_ar?: string
    mapsLink?: string
    mapEmbedUrl?: string
    logoUrl?: string | null
    notificationSound?: string
    openingHours?: Array<{ open?: string; close?: string }> | null
    customDateHours?: Array<{ date?: string; open?: string; close?: string }> | null
    socials?: {
      facebook?: string
      instagram?: string
      tiktok?: string
      snapchat?: string
      whatsapp?: string
      website?: string
    }
  } | null
}

const MAX_IMAGE_BYTES = 4 * 1024 * 1024 // 4 MB

type FormState = {
  name: string
  businessType: string
  businessSubcategoryIds: string[]
  country: string
  city: string
  ownerPhone: string
  name_en: string
  name_ar: string
  tagline_en: string
  tagline_ar: string
  address_en: string
  address_ar: string
  mapsLink: string
  mapEmbedUrl: string
  facebook: string
  instagram: string
  tiktok: string
  snapchat: string
  whatsapp: string
  website: string
  logoAssetId: string
  notificationSound: string
  deactivated: boolean
  deactivateUntil: string
  defaultLanguage: string
  catalogMode: boolean
  supportsDineIn: boolean
  supportsReceiveInPerson: boolean
  supportsDelivery: boolean
  openingHours: Array<{ open: string; close: string }>
  customDateHours: Array<{ date: string; open: string; close: string }>
}

function formSnapshotFromData(d: BusinessData): FormState {
  const tenant = d.tenant
  const r = d.restaurantInfo
  return {
    name: tenant?.name ?? '',
    businessType: tenant?.businessType ?? '',
    businessSubcategoryIds: Array.isArray(tenant?.businessSubcategoryIds) ? tenant.businessSubcategoryIds : [],
    country: tenant?.country ?? '',
    city: tenant?.city ?? '',
    ownerPhone: tenant?.ownerPhone ?? '',
    name_en: r?.name_en ?? '',
    name_ar: r?.name_ar ?? '',
    tagline_en: r?.tagline_en ?? '',
    tagline_ar: r?.tagline_ar ?? '',
    address_en: r?.address_en ?? '',
    address_ar: r?.address_ar ?? '',
    mapsLink: r?.mapsLink ?? '',
    mapEmbedUrl: r?.mapEmbedUrl ?? '',
    facebook: r?.socials?.facebook ?? '',
    instagram: r?.socials?.instagram ?? '',
    tiktok: r?.socials?.tiktok ?? '',
    snapchat: r?.socials?.snapchat ?? '',
    whatsapp: r?.socials?.whatsapp ?? '',
    website: r?.socials?.website ?? '',
    logoAssetId: '',
    notificationSound: r?.notificationSound ?? '1.wav',
    deactivated: tenant?.deactivated ?? false,
    deactivateUntil: tenant?.deactivateUntil ?? '',
    defaultLanguage: tenant?.defaultLanguage ?? '',
    catalogMode: (tenant?.supportsDineIn === false && tenant?.supportsReceiveInPerson === false),
    supportsDineIn: tenant?.supportsDineIn ?? true,
    supportsReceiveInPerson: tenant?.supportsReceiveInPerson ?? true,
    supportsDelivery: tenant?.supportsDelivery ?? true,
    openingHours: Array.isArray(r?.openingHours) && r.openingHours.length > 0
      ? Array.from({ length: 7 }, (_, i) => ({ open: r!.openingHours![i]?.open ?? '', close: r!.openingHours![i]?.close ?? '' }))
      : Array.from({ length: 7 }, () => ({ open: '', close: '' })),
    customDateHours: Array.isArray(r?.customDateHours)
      ? r.customDateHours.filter((x: { date?: string }) => x?.date).map((x: { date?: string; open?: string; close?: string }) => ({ date: x.date ?? '', open: x.open ?? '', close: x.close ?? '' }))
      : [],
  }
}

export function BusinessManageClient({ slug, menuUrl }: { slug: string; menuUrl?: string }) {
  const [data, setData] = useState<BusinessData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [countries, setCountries] = useState<CountryOption[]>([])
  const [cities, setCities] = useState<string[]>([])
  const [citiesLoading, setCitiesLoading] = useState(false)
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])
  const [subcategoriesLoading, setSubcategoriesLoading] = useState(false)
  const [form, setForm] = useState({
    name: '',
    businessType: '',
    businessSubcategoryIds: [] as string[],
    country: '',
    city: '',
    ownerPhone: '',
    name_en: '',
    name_ar: '',
    tagline_en: '',
    tagline_ar: '',
    address_en: '',
    address_ar: '',
    mapsLink: '',
    mapEmbedUrl: '',
    facebook: '',
    instagram: '',
    tiktok: '',
    snapchat: '',
    whatsapp: '',
    website: '',
    logoAssetId: '' as string,
    notificationSound: '1.wav',
    deactivated: false,
    deactivateUntil: '', // ISO string or '' for none
    defaultLanguage: '' as string,
    /** When true, menu is catalog-only (no orders). Dine-in, In Person, and Delivery are off. */
    catalogMode: false as boolean,
    supportsDineIn: true as boolean,
    supportsReceiveInPerson: true as boolean,
    supportsDelivery: true as boolean,
    openingHours: Array.from({ length: 7 }, () => ({ open: '', close: '' })),
    customDateHours: [] as Array<{ date: string; open: string; close: string }>,
  })
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [logoUploading, setLogoUploading] = useState(false)
  const [setAllOpen, setSetAllOpen] = useState('')
  const [setAllClose, setSetAllClose] = useState('')
  const logoInputRef = useRef<HTMLInputElement>(null)
  /** Snapshot of form when last saved (or when loaded); used to detect unsaved changes. */
  const lastSavedRef = useRef<typeof form | null>(null)
  /** When true, skip the next effect that applies context data (avoids overwriting form with stale refetch after save). */
  const skipNextApplyRef = useRef(false)
  const { showToast } = useToast()
  const { t, lang } = useLanguage()
  const businessContext = useTenantBusiness()

  const api = (path: string, options?: RequestInit) =>
    fetch(`/api/tenants/${slug}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...options?.headers } })

  // Load countries once (registration-only: Israel & Palestine for now)
  useEffect(() => {
    fetch('/api/countries?registration=1')
      .then((r) => r.json())
      .then((list) => setCountries(Array.isArray(list) ? list : []))
      .catch(() => setCountries([]))
  }, [])

  // Load business data: use context if already available (instant show), otherwise fetch so we never stay stuck on Loading.
  useEffect(() => {
    const controller = new AbortController()
    const defaultGeo = { countryCode: null as string | null, countryName: null as string | null }

    const applyBusinessAndGeo = (d: BusinessData | null, geo: { countryCode?: string | null; countryName?: string | null }) => {
      setData(d ?? null)
      if (d?.tenant) {
        let country = d.tenant.country || ''
        let city = d.tenant.city || ''
        if (!country && geo?.countryCode) country = geo.countryCode
        setForm((f) => ({
          ...f,
          name: d.tenant!.name || '',
          businessType: d.tenant!.businessType || '',
          businessSubcategoryIds: Array.isArray(d.tenant!.businessSubcategoryIds) ? d.tenant!.businessSubcategoryIds : [],
          country,
          city,
          ownerPhone: d.tenant!.ownerPhone || '',
          deactivated: d.tenant!.deactivated ?? false,
          deactivateUntil: d.tenant!.deactivateUntil || '',
          defaultLanguage: d.tenant!.defaultLanguage || '',
          catalogMode: (d.tenant!.supportsDineIn === false && d.tenant!.supportsReceiveInPerson === false),
          supportsDineIn: d.tenant!.supportsDineIn ?? true,
          supportsReceiveInPerson: d.tenant!.supportsReceiveInPerson ?? true,
          supportsDelivery: d.tenant!.supportsDelivery ?? true,
        }))
      } else if (geo?.countryCode) {
        setForm((f) => ({ ...f, country: geo.countryCode ?? '' }))
      }
      if (d?.restaurantInfo) {
        const r = d.restaurantInfo
        setForm((f) => ({
          ...f,
          name_en: r.name_en || '',
          name_ar: r.name_ar || '',
          tagline_en: r.tagline_en || '',
          tagline_ar: r.tagline_ar || '',
          address_en: r.address_en || '',
          address_ar: r.address_ar || '',
          mapsLink: r.mapsLink || '',
          mapEmbedUrl: r.mapEmbedUrl || '',
          facebook: r.socials?.facebook || '',
          instagram: r.socials?.instagram || '',
          tiktok: r.socials?.tiktok || '',
          snapchat: r.socials?.snapchat || '',
          whatsapp: r.socials?.whatsapp || '',
          website: r.socials?.website || '',
          notificationSound: r.notificationSound || '1.wav',
          openingHours: Array.isArray(r.openingHours) && r.openingHours.length > 0
            ? Array.from({ length: 7 }, (_, i) => ({ open: r.openingHours![i]?.open ?? '', close: r.openingHours![i]?.close ?? '' }))
            : Array.from({ length: 7 }, () => ({ open: '', close: '' })),
          customDateHours: Array.isArray(r.customDateHours)
            ? r.customDateHours.filter((x: { date?: string }) => x?.date).map((x: { date?: string; open?: string; close?: string }) => ({ date: x.date ?? '', open: x.open ?? '', close: x.close ?? '' }))
            : [],
        }))
        setLogoPreviewUrl(r.logoUrl || null)
      }
      if (d) {
        const snap = formSnapshotFromData(d)
        if (geo?.countryCode && !snap.country) snap.country = geo.countryCode
        lastSavedRef.current = snap
      }
    }

    const ctxData = businessContext.data as BusinessData | null
    const hasContextData = ctxData != null && ctxData.tenant != null

    if (hasContextData) {
      if (skipNextApplyRef.current) {
        skipNextApplyRef.current = false
        return () => controller.abort()
      }
      applyBusinessAndGeo(ctxData, defaultGeo)
      setLoading(false)
      fetch('/api/geo', { signal: controller.signal })
        .then((r) => r.json())
        .catch(() => defaultGeo)
        .then((geo) => {
          const code = (geo as { countryCode?: string | null })?.countryCode
          setForm((f) => {
            if (f.country) return f
            return code ? { ...f, country: code } : f
          })
          if (code && lastSavedRef.current) lastSavedRef.current = { ...lastSavedRef.current, country: code }
        })
      return () => controller.abort()
    }

    // No context data yet: fetch so we never stay stuck on Loading.
    setLoading(true)
    Promise.all([
      api('/business').then((r) => r.json()),
      fetch('/api/geo', { signal: controller.signal }).then((r) => r.json()).catch(() => defaultGeo),
    ])
      .then(([d, geo]) => applyBusinessAndGeo(d as BusinessData, geo as typeof defaultGeo))
      .catch(() => setLoading(false))
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [slug, businessContext.data])

  // Normalize saved country: if it's a name, resolve to code
  useEffect(() => {
    if (countries.length === 0 || !form.country) return
    const byCode = countries.some((c) => c.code === form.country)
    if (byCode) return
    const byName = countries.find((c) => c.name === form.country)
    if (byName) setForm((f) => ({ ...f, country: byName.code }))
  }, [countries, form.country])

  // Load cities when country changes
  const loadCities = useCallback((countryCode: string) => {
    if (!countryCode) {
      setCities([])
      return
    }
    setCitiesLoading(true)
    fetch(`/api/cities?country=${encodeURIComponent(countryCode)}`)
      .then((r) => r.json())
      .then((list) => setCities(Array.isArray(list) ? list : []))
      .catch(() => setCities([]))
      .finally(() => setCitiesLoading(false))
  }, [])

  useEffect(() => {
    loadCities(form.country)
  }, [form.country, loadCities])

  useEffect(() => {
    if (!form.businessType) {
      setSubcategories([])
      return
    }
    setSubcategoriesLoading(true)
    fetch(`/api/business-subcategories?businessType=${encodeURIComponent(form.businessType)}`)
      .then((r) => r.json())
      .then((data) => setSubcategories(Array.isArray(data) ? data : []))
      .catch(() => setSubcategories([]))
      .finally(() => setSubcategoriesLoading(false))
  }, [form.businessType])

  const setBusinessType = (value: string) => {
    setForm((f) => ({ ...f, businessType: value, businessSubcategoryIds: [] }))
  }

  const toggleSubcategory = (id: string) => {
    setForm((f) => {
      const ids = f.businessSubcategoryIds || []
      const i = ids.indexOf(id)
      const next = i >= 0 ? ids.filter((_, j) => j !== i) : [...ids, id]
      return { ...f, businessSubcategoryIds: next }
    })
  }

  const setCountry = (code: string) => {
    setForm((f) => ({ ...f, country: code, city: '' }))
  }
  const setCity = (city: string) => setForm((f) => ({ ...f, city }))

  const playNotificationSound = (soundFile: string) => {
    const audio = new Audio(`/sounds/${soundFile}`)
    audio.volume = 0.7
    audio.play().catch(() => {})
  }

  const NOTIFICATION_SOUNDS = [
    { label: 'Sound 1 (Default)', labelAr: 'الصوت 1 (افتراضي)', value: '1.wav' },
    { label: 'Sound 2', labelAr: 'الصوت 2', value: '2.wav' },
    { label: 'Sound 3', labelAr: 'الصوت 3', value: '3.wav' },
    { label: 'Sound 4', labelAr: 'الصوت 4', value: '4.wav' },
    { label: 'Sound 5', labelAr: 'الصوت 5', value: '5.wav' },
    { label: 'Sound 6', labelAr: 'الصوت 6', value: '6.wav' },
  ]

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    if (file.size > MAX_IMAGE_BYTES) {
      showToast('Image is too large. Maximum size is 4 MB. Use a smaller or compressed image.', 'الصورة كبيرة جداً. الحد الأقصى 4 ميجابايت.', 'error')
      return
    }
    setLogoUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/tenants/${slug}/upload`, { method: 'POST', body: fd, credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg =
          res.status === 413
            ? 'Image is too large. Maximum size is 4 MB. Use a smaller or compressed image.'
            : (typeof (data as { error?: string }).error === 'string' ? (data as { error?: string }).error : null) ?? 'Upload failed'
        const msgAr = res.status === 413 ? 'الصورة كبيرة جداً. الحد الأقصى 4 ميجابايت.' : 'فشل الرفع.'
        showToast(msg, msgAr, 'error')
        setLogoPreviewUrl(null)
        return
      }
      const _id = (data as { _id?: string })._id
      if (!_id) throw new Error('No image ID')
      setForm((f) => ({ ...f, logoAssetId: _id }))
      setLogoPreviewUrl(URL.createObjectURL(file))
    } catch {
      setLogoPreviewUrl(null)
      showToast('Upload failed. Try a smaller image.', 'فشل الرفع. جرب صورة أصغر.', 'error')
    } finally {
      setLogoUploading(false)
      if (logoInputRef.current) logoInputRef.current.value = ''
    }
  }

  const doSave = useCallback(async () => {
    if (!logoPreviewUrl) {
      showToast('Please upload a business logo first.', 'يرجى رفع شعار العمل أولاً.', 'error')
      return
    }
    const mapsLinkTrimmed = form.mapsLink?.trim()
    if (!mapsLinkTrimmed) {
      showToast('Google Maps link is required. Add your business location link.', 'رابط Google Maps مطلوب. أضف رابط موقع عملك.', 'error')
      return
    }
    setSaving(true)
    try {
      const res = await api('/business', {
        method: 'PATCH',
        body: JSON.stringify({
          name: form.name,
          businessType: form.businessType || undefined,
          businessSubcategoryIds: form.businessSubcategoryIds?.length ? form.businessSubcategoryIds : undefined,
          country: form.country || undefined,
          city: form.city || undefined,
          ownerPhone: form.ownerPhone?.trim() || undefined,
          name_en: form.name_en || undefined,
          name_ar: form.name_ar || undefined,
          tagline_en: form.tagline_en || undefined,
          tagline_ar: form.tagline_ar || undefined,
          address_en: form.address_en || undefined,
          address_ar: form.address_ar || undefined,
          mapsLink: mapsLinkTrimmed,
          mapEmbedUrl: form.mapEmbedUrl || undefined,
          logoAssetId: form.logoAssetId || undefined,
          notificationSound: form.notificationSound || '1.wav',
          deactivated: form.deactivated,
          deactivateUntil: form.deactivateUntil || null,
          defaultLanguage: form.defaultLanguage || null,
          supportsDineIn: form.catalogMode ? false : form.supportsDineIn,
          supportsReceiveInPerson: form.catalogMode ? false : form.supportsReceiveInPerson,
          supportsDelivery: form.catalogMode ? false : form.supportsDelivery,
          openingHours: form.openingHours,
          customDateHours: form.customDateHours,
          socials: {
            facebook: form.facebook || undefined,
            instagram: form.instagram || undefined,
            tiktok: form.tiktok || undefined,
            snapchat: form.snapchat || undefined,
            whatsapp: form.whatsapp || undefined,
            website: form.website || undefined,
          },
        }),
      })
      if (res.ok) {
        showToast('Business saved successfully.', 'تم حفظ البيانات بنجاح.', 'success')
        lastSavedRef.current = JSON.parse(JSON.stringify(form))
        skipNextApplyRef.current = true
        setData((prev) => prev ? { ...prev, tenant: { ...prev.tenant, name: form.name, businessType: form.businessType, businessSubcategoryIds: form.businessSubcategoryIds, country: form.country, city: form.city, ownerPhone: form.ownerPhone } } : null)
        businessContext.refetch()
      } else {
        showToast('Failed to save. Please try again.', 'فشل الحفظ. يرجى المحاولة مرة أخرى.', 'error')
      }
    } catch {
      showToast('Failed to save. Please try again.', 'فشل الحفظ. يرجى المحاولة مرة أخرى.', 'error')
    } finally {
      setSaving(false)
    }
  }, [form, logoPreviewUrl, api, showToast, businessContext])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await doSave()
  }

  const isDirty = lastSavedRef.current != null && JSON.stringify(form) !== JSON.stringify(lastSavedRef.current)

  const EXPANDED_MS = 5000
  const [availabilityExpanded, setAvailabilityExpanded] = useState(true)
  const availabilityTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    setAvailabilityExpanded(true)
    if (availabilityTimeoutRef.current) clearTimeout(availabilityTimeoutRef.current)
    availabilityTimeoutRef.current = setTimeout(() => {
      setAvailabilityExpanded(false)
      availabilityTimeoutRef.current = null
    }, EXPANDED_MS)
    return () => {
      if (availabilityTimeoutRef.current) clearTimeout(availabilityTimeoutRef.current)
    }
  }, [form.deactivated])

  if (loading) return <p className="text-slate-500 py-4">{t('Loading…', 'جارٍ التحميل…')}</p>

  return (
    <div className="relative pb-24 md:pb-8">
    <div className="space-y-6">
      <h1 className="text-xl font-bold md:text-2xl">{t('Manage Business', 'إدارة العمل')}</h1>
      <p className="mt-1 text-slate-400 text-sm md:text-base">
        {t(
          'Edit your store name, country & city (for delivery), and store details shown on your menu page.',
          'عدّل اسم المتجر والبلد والمدينة (للتوصيل)، وتفاصيل المتجر المعروضة على صفحة القائمة.'
        )}
      </p>

      {/* Menu QR Code — only on Business Profile */}
      {menuUrl && (
        <div className="max-w-[320px]">
          <TenantQRCode menuUrl={menuUrl} slug={slug} />
        </div>
      )}

      {/* Schedule & availability: manual open/close + weekly hours */}
      <div className="max-w-2xl rounded-xl border border-slate-800/60 bg-slate-950/60 p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-2">
          <Clock className="h-5 w-5 text-amber-400 shrink-0" />
          <h2 className="font-semibold text-white text-base md:text-lg">{t('Schedule & availability', 'الجدول والتوفر')}</h2>
        </div>
        <p className="mb-4 text-xs text-slate-400">
          {t('Manual open/close overrides your weekly hours. Set hours below so customers see when you’re open.', 'الفتح/الإغلاق اليدوي يتجاوز ساعاتك الأسبوعية. حدد الساعات أدناه ليرى العملاء متى أنت مفتوح.')}
        </p>
        <p className="mb-3 text-xs font-medium text-slate-400">{t('Business status', 'حالة المتجر')}</p>
        <div className="flex w-full justify-center">
          <motion.button
            type="button"
            onClick={() => setForm((f) => ({ ...f, deactivated: !f.deactivated, ...(f.deactivated ? {} : { deactivateUntil: '' }) }))}
            className={
              'touch-manipulation rounded-xl font-bold text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 flex min-h-[48px] items-center justify-center overflow-hidden ' +
              (!form.deactivated
                ? 'bg-green-600 text-white hover:bg-green-500 active:bg-green-700'
                : 'border-2 border-slate-600 bg-slate-800/80 text-slate-300 hover:border-slate-500 hover:bg-slate-800 active:bg-slate-700')
            }
            initial={false}
            animate={{ width: availabilityExpanded ? '100%' : '7rem' }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
          >
            <span className="px-4 py-3">
              <AnimatePresence mode="wait">
                {availabilityExpanded ? (
                  <motion.span key="expanded" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="block truncate">
                    {!form.deactivated ? t('Business is open', 'المتجر مفتوح') : t('Business is closed. Set date/time below to re-open.', 'المتجر مغلق. حدد التاريخ والوقت أدناه لإعادة الفتح.')}
                  </motion.span>
                ) : (
                  <motion.span key="compact" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                    {!form.deactivated ? t('Open', 'مفتوح') : t('Closed', 'مغلق')}
                  </motion.span>
                )}
              </AnimatePresence>
            </span>
          </motion.button>
        </div>
        {form.deactivated && (
          <div className="mt-4">
            <label className="mb-1.5 block text-xs font-medium text-slate-400">{t('Re-open at (date & time)', 'إعادة الفتح في (التاريخ والوقت)')}</label>
            <Input
              type="datetime-local"
              value={form.deactivateUntil ? (() => {
                const d = new Date(form.deactivateUntil)
                const pad = (n: number) => String(n).padStart(2, '0')
                return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
              })() : ''}
              onChange={(e) => setForm((f) => ({ ...f, deactivateUntil: e.target.value ? new Date(e.target.value).toISOString() : '' }))}
              className="w-full max-w-xs bg-slate-800 border-slate-600 text-white"
            />
            <p className="mt-1 text-[10px] text-slate-500">{t('Optional. Leave empty to stay closed until you turn it back on.', 'اختياري. اتركه فارغاً للبقاء مغلقاً حتى تعيد التفعيل.')}</p>
          </div>
        )}
        {/* Opening hours — same card as schedule */}
        <div className="mt-6 pt-5 border-t border-slate-700/60">
          <h3 className="mb-3 font-semibold text-white text-sm">{t('Weekly opening hours', 'ساعات العمل الأسبوعية')}</h3>
          <p className="mb-3 text-xs text-slate-500">
            {t('Set your business hours per day (Sunday–Saturday). Shown on your menu. Leave empty for closed.', 'حدد ساعات العمل لكل يوم (الأحد–السبت). تظهر على قائمتك. اترك فارغاً للإغلاق.')}
          </p>
          <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-700/50 bg-slate-800/30 p-3">
              <span className="text-xs font-medium text-slate-400">{t('Change all days at once', 'تغيير كل الأيام مرة واحدة')}:</span>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  type="time"
                  className="w-28 bg-slate-800 border-slate-600 text-white"
                  value={setAllOpen}
                  onChange={(e) => setSetAllOpen(e.target.value)}
                />
                <Input
                  type="time"
                  className="w-28 bg-slate-800 border-slate-600 text-white"
                  value={setAllClose}
                  onChange={(e) => setSetAllClose(e.target.value)}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-slate-600 bg-slate-800 text-slate-200"
                  onClick={() => setForm((f) => ({ ...f, openingHours: Array(7).fill(null).map(() => ({ open: setAllOpen, close: setAllClose })) }))}
                >
                  {t('Apply to all days', 'تطبيق على كل الأيام')}
                </Button>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-slate-600 bg-slate-800 text-slate-200"
                onClick={() => setForm((f) => ({ ...f, openingHours: Array(7).fill(null).map(() => ({ open: '', close: '' })) }))}
              >
                {t('Clear all hours', 'مسح كل الساعات')}
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[320px] text-sm">
                <thead>
                  <tr className="border-b border-slate-700 text-left text-xs text-slate-400">
                    <th className="pb-2 pr-2">{t('Day', 'اليوم')}</th>
                    <th className="pb-2 pr-2">{t('Open', 'فتح')}</th>
                    <th className="pb-2">{t('Close', 'إغلاق')}</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    t('Sunday', 'الأحد'),
                    t('Monday', 'الاثنين'),
                    t('Tuesday', 'الثلاثاء'),
                    t('Wednesday', 'الأربعاء'),
                    t('Thursday', 'الخميس'),
                    t('Friday', 'الجمعة'),
                    t('Saturday', 'السبت'),
                  ].map((dayLabel, i) => (
                    <tr key={i} className="border-b border-slate-700/50">
                      <td className="py-2 pr-2 font-medium text-white">{dayLabel}</td>
                      <td className="py-2 pr-2">
                        <Input
                          type="time"
                          className="h-9 w-28 bg-slate-800 border-slate-600 text-white"
                          value={form.openingHours[i]?.open ?? ''}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              openingHours: f.openingHours.map((d, j) => (j === i ? { ...d, open: e.target.value } : d)),
                            }))
                          }
                        />
                      </td>
                      <td className="py-2">
                        <Input
                          type="time"
                          className="h-9 w-28 bg-slate-800 border-slate-600 text-white"
                          value={form.openingHours[i]?.close ?? ''}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              openingHours: f.openingHours.map((d, j) => (j === i ? { ...d, close: e.target.value } : d)),
                            }))
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-slate-400">{t('Custom dates (e.g. holidays)', 'تواريخ مخصصة (مثلاً العطل)')}</p>
              {form.customDateHours.map((custom, idx) => (
                <div key={idx} className="mb-2 flex flex-wrap items-center gap-2">
                  <Input
                    type="date"
                    className="w-36 bg-slate-800 border-slate-600 text-white"
                    value={custom.date}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        customDateHours: f.customDateHours.map((c, j) => (j === idx ? { ...c, date: e.target.value } : c)),
                      }))
                    }
                  />
                  <Input
                    type="time"
                    className="w-28 bg-slate-800 border-slate-600 text-white"
                    value={custom.open}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        customDateHours: f.customDateHours.map((c, j) => (j === idx ? { ...c, open: e.target.value } : c)),
                      }))
                    }
                  />
                  <Input
                    type="time"
                    className="w-28 bg-slate-800 border-slate-600 text-white"
                    value={custom.close}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        customDateHours: f.customDateHours.map((c, j) => (j === idx ? { ...c, close: e.target.value } : c)),
                      }))
                    }
                  />
                  <Button type="button" variant="ghost" size="sm" className="text-red-400" onClick={() => setForm((f) => ({ ...f, customDateHours: f.customDateHours.filter((_, j) => j !== idx) }))}>
                    {t('Remove', 'إزالة')}
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-slate-600 bg-slate-800 text-slate-200"
                onClick={() => setForm((f) => ({ ...f, customDateHours: [...f.customDateHours, { date: '', open: '', close: '' }] }))}
              >
                + {t('Add custom date', 'إضافة تاريخ مخصص')}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 max-w-2xl space-y-8 rounded-xl border border-slate-800/60 bg-slate-900/40 p-5 sm:p-6 md:p-8">
        {/* Default language + Order types - near top of form */}
        <div className="dashboard-section">
          <h2 className="mb-4 font-semibold text-white text-base md:text-lg">{t('Dashboard language & order types', 'لغة لوحة التحكم وأنواع الطلب')}</h2>
          <div className="space-y-5">
            <div>
              <label className="dashboard-label block text-slate-400">{t('Default language (your dashboard)', 'اللغة الافتراضية (لوحة التحكم)')}</label>
              <select
                value={form.defaultLanguage || 'ar'}
                onChange={(e) => setForm((f) => ({ ...f, defaultLanguage: e.target.value }))}
                className="dashboard-select mt-1 w-full max-w-xs border border-slate-600 bg-slate-800 text-white"
              >
                <option value="ar">{t('Arabic', 'العربية')}</option>
                <option value="en">{t('English', 'English')}</option>
              </select>
              <p className="mt-1 text-xs text-slate-500">{t('Language for manage pages. Customer menu language is chosen by the customer.', 'لغة صفحات الإدارة. لغة قائمة العملاء يختارها العميل.')}</p>
            </div>
            <div>
              <p className="dashboard-label mb-1 text-slate-400">{t('Catalog?', 'كتالوج فقط؟')}</p>
              <p className="mb-3 text-sm text-slate-500 max-w-xl">
                {t(
                  'Choose "Yes" if you only want to show your menu online — no ordering, no cart, no delivery. Customers can browse items and prices only. Ideal for displaying your offer, sharing your menu link, or when you take orders by phone or elsewhere. Choose "No" when you want customers to place orders through this site (dine-in, pickup, or delivery).',
                  'اختر "نعم" إذا أردت عرض قائمتك فقط على الإنترنت — بدون طلبات أو سلة أو توصيل. يمكن للعملاء تصفح المنتجات والأسعار فقط. مناسب لعرض العروض أو مشاركة رابط القائمة أو عندما تستقبل الطلبات هاتفياً أو عبر قنوات أخرى. اختر "لا" عندما تريد أن يقدّم العملاء الطلبات عبر الموقع (تناول في المكان أو استلام شخصي أو توصيل).'
                )}
              </p>
              <div className="mb-3 flex flex-wrap gap-4">
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-700/50 bg-slate-800/30 px-4 py-2.5 has-[:checked]:border-amber-500/60 has-[:checked]:bg-amber-500/10">
                  <input
                    type="radio"
                    name="catalogMode"
                    checked={form.catalogMode === true}
                    onChange={() => setForm((f) => ({ ...f, catalogMode: true, supportsDineIn: false, supportsReceiveInPerson: false, supportsDelivery: false }))}
                    className="border-slate-600 bg-slate-800 accent-amber-500"
                  />
                  <span className="text-sm font-medium text-white">{t('Yes — menu is view-only (no orders)', 'نعم — القائمة للعرض فقط (بدون طلبات)')}</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-700/50 bg-slate-800/30 px-4 py-2.5 has-[:checked]:border-amber-500/60 has-[:checked]:bg-amber-500/10">
                  <input
                    type="radio"
                    name="catalogMode"
                    checked={form.catalogMode === false}
                    onChange={() => setForm((f) => ({ ...f, catalogMode: false, supportsDineIn: f.supportsDineIn || true, supportsReceiveInPerson: f.supportsReceiveInPerson || true, supportsDelivery: f.supportsDelivery || true }))}
                    className="border-slate-600 bg-slate-800 accent-amber-500"
                  />
                  <span className="text-sm font-medium text-white">{t('No — accept orders', 'لا — قبول الطلبات')}</span>
                </label>
              </div>
              {form.catalogMode ? (
                <p className="text-xs text-slate-500 rounded-lg border border-slate-700/40 bg-slate-800/30 px-3 py-2">
                  {t('Catalog mode is on: your menu link shows items and prices only — no Add to Cart or checkout. Dine-in, Receive in Person, and Delivery are disabled. To also hide any delivery option, remove all delivery areas in the Delivery areas page.', 'وضع الكتالوج مفعّل: رابط قائمتك يعرض المنتجات والأسعار فقط — بدون إضافة إلى السلة أو دفع. تناول في المكان واستلام شخصي والتوصيل معطّلان. لإخفاء خيار التوصيل أيضاً، احذف كل مناطق التوصيل من صفحة "مناطق التوصيل".')}
                </p>
              ) : (
                <>
                  <p className="dashboard-label mb-2 mt-4 text-slate-400">{t('Accept these order types', 'قبول أنواع الطلب التالية')}</p>
                  <div className="space-y-3">
                    <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-700/50 bg-slate-800/30 px-3 py-2">
                      <input
                        type="checkbox"
                        checked={form.supportsDineIn}
                        onChange={(e) => setForm((f) => ({ ...f, supportsDineIn: e.target.checked }))}
                        className="rounded border-slate-600 bg-slate-800 accent-amber-500"
                      />
                      <UtensilsCrossed className="size-4 text-slate-400" />
                      <span className="text-sm text-white">{t('Dine-in (order at table)', 'تناول في المكان (طلب على الطاولة)')}</span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-700/50 bg-slate-800/30 px-3 py-2">
                      <input
                        type="checkbox"
                        checked={form.supportsReceiveInPerson}
                        onChange={(e) => setForm((f) => ({ ...f, supportsReceiveInPerson: e.target.checked }))}
                        className="rounded border-slate-600 bg-slate-800 accent-amber-500"
                      />
                      <Store className="size-4 text-slate-400" />
                      <span className="text-sm text-white">{t('Receive in Person (pickup)', 'استلام شخصي (من المتجر)')}</span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-700/50 bg-slate-800/30 px-3 py-2">
                      <input
                        type="checkbox"
                        checked={form.supportsDelivery}
                        onChange={(e) => setForm((f) => ({ ...f, supportsDelivery: e.target.checked }))}
                        className="rounded border-slate-600 bg-slate-800 accent-amber-500"
                      />
                      <MapPin className="size-4 text-slate-400" />
                      <span className="text-sm text-white">{t('Delivery', 'التوصيل')}</span>
                    </label>
                    <p className="text-xs text-slate-500">
                      {t('Customers see Delivery only when this is checked and you have at least one delivery area.', 'يرى العملاء خيار التوصيل فقط عند تفعيله هنا مع وجود منطقة توصيل واحدة على الأقل.')}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="dashboard-section">
          <h2 className="mb-4 font-semibold text-white text-base md:text-lg">{t('Store identity', 'هوية المتجر')}</h2>
          <div className="space-y-5">
            <div>
              <label className="dashboard-label block text-slate-400">{t('Business logo', 'شعار العمل')} *</label>
              <div className="mt-1 flex flex-wrap items-center gap-4">
                <div className="flex size-24 items-center justify-center overflow-hidden rounded-xl border border-slate-600 bg-slate-800/50">
                  {logoPreviewUrl ? (
                    <img src={logoPreviewUrl} alt="Logo" className="size-full object-contain" />
                  ) : (
                    <ImageIcon className="size-10 text-slate-500" />
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={handleLogoChange}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-11 px-4 border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white"
                    onClick={() => logoInputRef.current?.click()}
                    disabled={logoUploading}
                  >
                    <Upload className="mr-2 size-4" />
                    {logoUploading ? t('Uploading…', 'جارٍ الرفع…') : logoPreviewUrl ? t('Change logo', 'تغيير الشعار') : t('Upload logo', 'رفع شعار')}
                  </Button>
                  <p className="text-xs text-slate-500">{t('Required. JPEG, PNG, WebP or GIF. Shown on your menu and PWA.', 'مطلوب. JPEG أو PNG أو WebP أو GIF. يظهر في القائمة والتطبيق.')}</p>
                  <p className="mt-1.5 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-200/90">
                    <strong>{t('App icon', 'أيقونة التطبيق')}:</strong> {t('To show your logo when someone adds your menu to their home screen, they must use your menu link. If the icon still shows the old image, remove the app from the home screen and add it again from that link.', 'لعرض شعارك عند إضافة القائمة للشاشة الرئيسية، يجب استخدام رابط القائمة. إن ظهرت الصورة القديمة، احذف التطبيق من الشاشة الرئيسية وأضفه مرة أخرى من الرابط.')}
                  </p>
                </div>
              </div>
            </div>
            <div>
              <label className="dashboard-label block text-slate-400">{t('Store name', 'اسم المتجر')} *</label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="dashboard-input w-full bg-slate-800 border-slate-600 text-white"
                required
              />
              <p className="mt-1.5 text-xs text-slate-500">{t('Shown in the header of your menu (e.g. B Cafe).', 'يظهر في رأس القائمة (مثال: مقهى ب).')}</p>
            </div>
            <div>
              <label className="dashboard-label block text-slate-400">{t('Business category', 'التصنيف الرئيسي')} *</label>
              <select
                value={form.businessType}
                onChange={(e) => setBusinessType(e.target.value)}
                className="dashboard-select mt-1 w-full max-w-md border border-slate-600 bg-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                required
              >
                <option value="">{t('Select category', 'اختر التصنيف')}</option>
                {BUSINESS_TYPES.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {lang === 'ar' ? opt.labelAr : opt.label}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-slate-500">{t('Restaurant, Cafe, Bakery, etc. Used for discovery and filters.', 'مطعم، مقهى، مخبز، إلخ. يُستخدم للاستكشاف والفلاتر.')}</p>
            </div>
            {form.businessType && (
              <div>
                <label className="dashboard-label block text-slate-400">{t('Sub-categories (specialties)', 'التصنيفات الفرعية (التخصصات)')}</label>
                {subcategoriesLoading ? (
                  <p className="mt-1 text-xs text-slate-500">{t('Loading…', 'جاري التحميل…')}</p>
                ) : (
                  <div className="mt-1 flex flex-wrap gap-2">
                    {subcategories.map((sub) => {
                      const checked = (form.businessSubcategoryIds || []).includes(sub._id)
                      return (
                        <label key={sub._id} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${checked ? 'border-amber-500/60 bg-amber-500/20 text-amber-100' : 'border-slate-600 bg-slate-800/50 text-slate-300 hover:border-slate-500'}`}>
                          <input type="checkbox" checked={checked} onChange={() => toggleSubcategory(sub._id)} className="rounded accent-amber-500" />
                          {lang === 'ar' ? (sub.title_ar || sub.title_en) : (sub.title_en || sub.title_ar)}
                        </label>
                      )
                    })}
                    {subcategories.length === 0 && <p className="text-xs text-slate-500">{t('No sub-categories yet. Add them in Sanity Studio.', 'لا توجد تصنيفات فرعية بعد.')}</p>}
                  </div>
                )}
                <p className="mt-1.5 text-xs text-slate-500">{t('Select all that apply. e.g. Burgers, Sandwiches, Pizza.', 'اختر كل ما ينطبق. مثال: برجر، شطائر، بيتزا.')}</p>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="dashboard-label block text-slate-400">{t('Country', 'البلد')} *</label>
                <select
                  value={form.country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="dashboard-select w-full border border-slate-600 bg-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  required
                >
                  <option value="">{t('Select country', 'اختر البلد')}</option>
                  {countries.map((c) => (
                    <option key={c.code} value={c.code}>
                      {lang === 'ar' ? (getCountryNameAr(c.code) ?? c.name) : c.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs text-slate-500">{t('Required for drivers by area. Auto-detected from your location.', 'مطلوب للسائقين حسب المنطقة. يُكتشف تلقائياً من موقعك.')}</p>
              </div>
              <div>
                <label className="dashboard-label block text-slate-400">{t('City', 'المدينة')} *</label>
                <select
                  value={form.city}
                  onChange={(e) => setCity(e.target.value)}
                  disabled={!form.country || citiesLoading}
                  className="dashboard-select w-full border border-slate-600 bg-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 disabled:opacity-50"
                  required
                >
                  <option value="">{t('Select city', 'اختر المدينة')}</option>
                  {cities.map((name) => (
                    <option key={name} value={name}>
                      {lang === 'ar' ? (getCityNameAr(name) ?? name) : name}
                    </option>
                  ))}
                </select>
                {citiesLoading && <p className="mt-1.5 text-xs text-slate-500">{t('Loading cities…', 'جارٍ تحميل المدن…')}</p>}
              </div>
            </div>
            <div>
              <label className="dashboard-label block text-slate-400">{t('Your mobile / WhatsApp (owner)', 'جوالك / واتساب (المالك)')}</label>
              <Input
                type="tel"
                value={form.ownerPhone}
                onChange={(e) => setForm((f) => ({ ...f, ownerPhone: e.target.value }))}
                placeholder="+972 50 123 4567"
                className="dashboard-input w-full max-w-md border border-slate-600 bg-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
              <p className="mt-1.5 text-xs text-slate-500">
                {t('Used to place orders from the system. No SMS verification needed when set here.', 'يُستخدم لوضع الطلبات من النظام. لا حاجة للتحقق برسالة SMS عند تعيينه هنا.')}
              </p>
            </div>
          </div>
        </div>

        <div className="dashboard-section">
          <h2 className="mb-4 font-semibold text-white text-base md:text-lg">{t('Store details (menu page)', 'تفاصيل المتجر (صفحة القائمة)')}</h2>
          <p className="mb-4 text-xs text-slate-500">{t('Names and taglines shown on your public menu. Address and map for "Visit us" section.', 'الأسماء والشعارات المعروضة على القائمة العامة. العنوان والخريطة لقسم "زيارتنا".')}</p>
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="dashboard-label block text-slate-400">{t('Name (English)', 'الاسم (إنجليزي)')}</label>
                <Input
                  value={form.name_en}
                  onChange={(e) => setForm((f) => ({ ...f, name_en: e.target.value }))}
                  className="dashboard-input w-full bg-slate-800 border-slate-600 text-white"
                />
              </div>
              <div>
                <label className="dashboard-label block text-slate-400">{t('Name (Arabic)', 'الاسم (عربي)')}</label>
                <Input
                  value={form.name_ar}
                  onChange={(e) => setForm((f) => ({ ...f, name_ar: e.target.value }))}
                  className="dashboard-input w-full bg-slate-800 border-slate-600 text-white"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="dashboard-label block text-slate-400">{t('Tagline (EN)', 'شعار (EN)')}</label>
                <Input
                  value={form.tagline_en}
                  onChange={(e) => setForm((f) => ({ ...f, tagline_en: e.target.value }))}
                  className="bg-slate-800 border-slate-600 text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">Tagline (AR)</label>
                <Input
                  value={form.tagline_ar}
                  onChange={(e) => setForm((f) => ({ ...f, tagline_ar: e.target.value }))}
                  className="bg-slate-800 border-slate-600 text-white"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Address (EN)</label>
              <Input
                value={form.address_en}
                onChange={(e) => setForm((f) => ({ ...f, address_en: e.target.value }))}
                className="bg-slate-800 border-slate-600 text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Address (AR)</label>
              <Input
                value={form.address_ar}
                onChange={(e) => setForm((f) => ({ ...f, address_ar: e.target.value }))}
                className="bg-slate-800 border-slate-600 text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">
                {t('Google Maps link', 'رابط Google Maps')} *
              </label>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <Input
                  type="url"
                  value={form.mapsLink}
                  onChange={(e) => setForm((f) => ({ ...f, mapsLink: e.target.value }))}
                  placeholder="https://maps.google.com/..."
                  className="flex-1 min-w-[200px] bg-slate-800 border-slate-600 text-white"
                  required
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white"
                  onClick={() => window.open('https://www.google.com/maps', '_blank', 'noopener,noreferrer')}
                >
                  <MapPin className="mr-1.5 size-4 shrink-0" />
                  {t('Open Google Maps', 'فتح Google Maps')}
                </Button>
              </div>
              <p className="mt-1 text-[10px] text-slate-500">
                {t('Required. In Google Maps, find your business → Share → Copy link. Paste it here. Used for "Visit us" and driver navigation.', 'مطلوب. في Google Maps ابحث عن عملك ← مشاركة ← انسخ الرابط. الصقه هنا. يُستخدم في "زيارتنا" وتنقل السائق.')}
              </p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Embed map URL</label>
              <Input
                value={form.mapEmbedUrl}
                onChange={(e) => setForm((f) => ({ ...f, mapEmbedUrl: e.target.value }))}
                placeholder="https://www.google.com/maps/embed?pb=..."
                className="bg-slate-800 border-slate-600 text-white"
              />
              <p className="mt-1 text-[10px] text-slate-500">Google Maps → Share → Embed a map → copy the iframe src URL.</p>
            </div>
          </div>
        </div>

        <div>
          <h2 className="mb-3 font-semibold text-white">Social links</h2>
          <p className="mb-3 text-xs text-slate-500">
            {t('Full URL or username only (e.g. burhanstudio or https://instagram.com/burhanstudio). Links open your profile on the menu.', 'رابط كامل أو اسم المستخدم فقط (مثال: burhanstudio أو https://instagram.com/burhanstudio). الروابط تفتح صفحتك على القائمة.')}
          </p>
          <div className="grid grid-cols-2 gap-3">
            {(['facebook', 'instagram', 'tiktok', 'snapchat', 'website'] as const).map((key) => (
              <div key={key}>
                <label className="mb-1 block text-xs font-medium text-slate-400">{key}</label>
                <Input
                  type="text"
                  value={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  placeholder={key === 'website' ? 'example.com or https://...' : t('URL or username', 'رابط أو اسم مستخدم')}
                  className="bg-slate-800 border-slate-600 text-white"
                />
              </div>
            ))}
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">WhatsApp number</label>
              <Input
                value={form.whatsapp}
                onChange={(e) => setForm((f) => ({ ...f, whatsapp: toEnglishDigits(e.target.value) }))}
                placeholder="972501234567"
                className="bg-slate-800 border-slate-600 text-white"
              />
            </div>
          </div>
        </div>

        <div>
          <h2 className="mb-3 font-semibold text-white">
            <Volume2 className="mr-1.5 inline size-3.5" />
            {t('Notifications', 'الإشعارات')}
          </h2>
          <p className="mb-2 text-xs text-slate-500">
            {t(
              'Plays when a new order arrives on your Orders page. Click Play to preview.',
              'يُشغّل عند وصول طلب جديد في صفحة الطلبات. اضغط تشغيل للمعاينة.'
            )}
          </p>
          <div className="space-y-2">
            {NOTIFICATION_SOUNDS.map((opt) => (
              <div
                key={opt.value}
                className={`flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2 transition-colors ${
                  form.notificationSound === opt.value
                    ? 'border-amber-500/50 bg-amber-500/10'
                    : 'border-slate-700 bg-slate-800/50'
                }`}
              >
                <label className="flex flex-1 cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="notificationSound"
                    value={opt.value}
                    checked={form.notificationSound === opt.value}
                    onChange={() => setForm((f) => ({ ...f, notificationSound: opt.value }))}
                    className="size-4 accent-amber-500"
                  />
                  <span className="text-sm font-medium text-white">{t(opt.label, opt.labelAr)}</span>
                </label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-slate-600 bg-slate-800 text-white hover:bg-slate-700 hover:text-white"
                  onClick={() => playNotificationSound(opt.value)}
                >
                  <Play className="mr-1.5 size-3.5" />
                  {t('Play', 'تشغيل')}
                </Button>
              </div>
            ))}
          </div>
        </div>

        <Button type="submit" size="sm" className="bg-amber-500 text-slate-950 hover:bg-amber-400" disabled={saving}>
          {saving ? t('Saving…', 'جاري الحفظ…') : t('Save changes', 'حفظ التغييرات')}
        </Button>
      </form>

      {/* Delete business permanently - at the very bottom */}
      <div className="mt-10 max-w-2xl rounded-xl border border-red-900/50 bg-red-950/20 p-6">
        <h2 className="mb-2 flex items-center gap-2 font-semibold text-red-300">
          <AlertTriangle className="size-5" />
          {t('Delete business permanently', 'حذف العمل نهائياً')}
        </h2>
        <p className="mb-4 text-sm text-slate-400">
          {t('This will permanently delete your business and all its data (menu, areas, orders, etc.) from the system. This action cannot be undone.', 'سيتم حذف عملك وجميع بياناته (القائمة، المناطق، الطلبات، إلخ) نهائياً من النظام. لا يمكن التراجع عن هذا الإجراء.')}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-red-800 text-red-300 hover:bg-red-900/30 hover:text-red-200"
          onClick={() => setDeleteConfirmOpen(true)}
        >
          <Trash2 className="mr-2 size-4" />
          {t('Delete business permanently', 'حذف العمل نهائياً')}
        </Button>
      </div>

      {/* Delete confirmation modal */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-red-900/50 bg-slate-900 p-6 shadow-xl">
            <h3 className="mb-2 text-lg font-bold text-red-300">{t('Confirm permanent delete', 'تأكيد الحذف النهائي')}</h3>
            <p className="mb-4 text-sm text-slate-400">
              {t('To confirm, type your business name exactly as shown:', 'للتأكيد، اكتب اسم عملك كما يظهر بالضبط:')}
            </p>
            <p className="mb-2 font-mono text-sm font-semibold text-amber-400">&quot;{form.name}&quot;</p>
            <Input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder={form.name}
              className="mb-4 bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
              autoFocus
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white"
                onClick={() => { setDeleteConfirmOpen(false); setDeleteConfirmText('') }}
                disabled={deleting}
              >
                {t('Cancel', 'إلغاء')}
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-red-600 text-white hover:bg-red-500"
                disabled={deleting || deleteConfirmText.trim() !== form.name.trim()}
                onClick={async () => {
                  if (deleteConfirmText.trim() !== form.name.trim()) return
                  setDeleting(true)
                  try {
                    const res = await api('/business/delete', { method: 'DELETE' })
                    if (res.ok) {
                      showToast(t('Business deleted. Redirecting…', 'تم حذف العمل. جاري التحويل…'), '', 'success')
                      window.location.href = '/dashboard'
                    } else {
                      const data = await res.json().catch(() => ({}))
                      showToast(data?.error || t('Failed to delete.', 'فشل الحذف.'), '', 'error')
                    }
                  } catch {
                    showToast(t('Failed to delete.', 'فشل الحذف.'), '', 'error')
                  } finally {
                    setDeleting(false)
                  }
                }}
              >
                {deleting ? t('Deleting…', 'جاري الحذف…') : t('Delete permanently', 'حذف نهائياً')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>

    {/* Floating Save — appears when there are unsaved changes */}
    <AnimatePresence>
      {isDirty && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="fixed left-4 right-4 md:left-auto md:right-6 bottom-6 z-40 md:max-w-sm"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)' }}
        >
          <div className="mx-auto md:ml-auto md:mr-0 w-full max-w-md md:max-w-none shadow-xl shadow-black/30 rounded-2xl bg-slate-800 border border-amber-500/40 p-3 md:p-3">
            <p className="text-xs text-slate-400 mb-2 px-1">
              {t('You have unsaved changes', 'لديك تغييرات غير محفوظة')}
            </p>
            <Button
              type="button"
              onClick={() => doSave()}
              disabled={saving}
              className="w-full h-12 rounded-xl font-bold text-base bg-amber-500 text-slate-950 hover:bg-amber-400 active:bg-amber-600 disabled:opacity-70 flex items-center justify-center gap-2"
            >
              <Save className="size-5" />
              {saving ? t('Saving…', 'جاري الحفظ…') : t('Save changes', 'حفظ التغييرات')}
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
    </div>
  )
}
