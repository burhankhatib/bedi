'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/ToastProvider'
import { useLanguage } from '@/components/LanguageContext'
import { BUSINESS_CATEGORY_OPTIONS, BUSINESS_TYPES, STORE_BUSINESS_TYPES } from '@/lib/constants'
import { compressImageForUpload } from '@/lib/compress-image'
import { getCountryNameAr, getCityNameAr } from '@/lib/registration-translations'
import { toEnglishDigits } from '@/lib/phone'
import { detectCityAndCountry } from '@/lib/geofencing-utils'
import { Upload, ImageIcon, Volume2, Play, AlertTriangle, Trash2, Store, UtensilsCrossed, Clock, MapPin, Save, LocateFixed, RefreshCw, Activity, CheckCircle2, XCircle, Timer } from 'lucide-react'
import { TenantQRCode } from '@/components/TenantQRCode'
import { useTenantBusiness } from '../TenantBusinessContext'
import { isAbortError } from '@/lib/abort-utils'
import { AUTO_DELIVERY_DROPDOWN_SEQUENCE } from '@/lib/auto-delivery-request'
import dynamic from 'next/dynamic'

const LocationPickerMap = dynamic(() => import('@/components/Cart/LocationPickerMap'), { ssr: false })

type CountryOption = { code: string; name: string }
type Subcategory = { _id: string; slug: string; title_en: string; title_ar: string; businessType: string }
type BusinessData = {
  tenant: {
    _id: string
    name: string
    slug?: string
    country?: string
    city?: string
    businessType?: string
    businessSubcategoryIds?: string[]
    ownerPhone?: string
    deactivated?: boolean
    deactivateUntil?: string | null
    defaultLanguage?: string | null
    catalogHidePrices?: boolean
    supportsDineIn?: boolean
    supportsReceiveInPerson?: boolean
    supportsDelivery?: boolean
    freeDeliveryEnabled?: boolean
    supportsDriverPickup?: boolean
    defaultAutoDeliveryRequestMinutes?: number | null
    saveAutoDeliveryRequestPreference?: boolean
    prioritizeWhatsapp?: boolean
    locationLat?: number
    locationLng?: number
  }
  restaurantInfo: {
    name_en?: string
    name_ar?: string
    tagline_en?: string
    tagline_ar?: string
    address_en?: string
    address_ar?: string
    logoUrl?: string | null
    /** Sanity image asset id when a logo already exists (for saves without re-upload). */
    logoAssetId?: string | null
    notificationSound?: string
    openingHours?: Array<{ open?: string; close?: string; shifts?: { open?: string; close?: string }[] }> | null
    customDateHours?: Array<{ date?: string; open?: string; close?: string; shifts?: { open?: string; close?: string }[] }> | null
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

/** Small inline component: share device GPS as business location. */
function BusinessLocationShare({ slug, onSuccess, onCityDetected }: { slug: string; onSuccess?: (lat: number, lng: number) => void; onCityDetected?: (countryCode: string, city: string) => void }) {
  const { t } = useLanguage()
  const { showToast } = useToast()
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle')
  const [saved, setSaved] = useState<{ lat: number; lng: number } | null>(null)

  const shareLocation = async () => {
    if (!navigator.geolocation) {
      showToast('Location is not supported in this browser.', 'الموقع غير مدعوم في هذا المتصفح.', 'error')
      return
    }
    setState('loading')
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        try {
          const res = await fetch(`/api/tenants/${encodeURIComponent(slug)}/location`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lat, lng }),
          })
          if (!res.ok) throw new Error('Failed to save location')
          setSaved({ lat, lng })
          setState('done')
          if (onSuccess) onSuccess(lat, lng)
          // Auto-detect city from GPS polygon boundaries
          const detected = detectCityAndCountry(lng, lat)
          if (detected && onCityDetected) onCityDetected(detected.countryCode, detected.city)
          showToast('تم حفظ موقع العمل بنجاح!' + (detected ? ` (${detected.city})` : ''), undefined, 'success')
        } catch {
          setState('idle')
          showToast('فشل حفظ الموقع. حاول مرة أخرى.', undefined, 'error')
        }
      },
      (err) => {
        setState('idle')
        if (err.code === 1) {
          showToast(
            'Location access denied. Enable it in your browser or device settings.',
            'تم رفض الوصول للموقع. فعّله من إعدادات المتصفح أو الجهاز.',
            'error'
          )
        } else {
          showToast('Could not get location. Try again.', 'تعذّر الحصول على الموقع. حاول مرة أخرى.', 'error')
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  }

  return (
    <div className="rounded-xl border border-blue-900/30 bg-blue-950/20 p-4">
      <p className="mb-3 text-xs text-slate-400">
        {t(
          'Share your current device location as the exact business address. This provides the most accurate navigation for drivers.',
          'شارك موقع جهازك الحالي كعنوان دقيق للعمل. هذا يوفر التنقل الأكثر دقة للسائقين.'
        )}
      </p>
      {saved && (
        <p className="mb-2 text-xs text-emerald-400">
          {t('Saved', 'تم الحفظ')}: {saved.lat.toFixed(6)}, {saved.lng.toFixed(6)}
        </p>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={state === 'loading'}
        className="w-full sm:w-auto border-blue-500/50 bg-blue-600 text-white hover:bg-blue-500 hover:text-white"
        onClick={shareLocation}
      >
        <LocateFixed className={`mr-1.5 h-4 w-4 shrink-0 rtl:ml-1.5 rtl:mr-0 ${state === 'loading' ? 'animate-pulse' : ''}`} />
        {state === 'loading'
          ? t('Getting location…', 'جاري تحديد الموقع…')
          : state === 'done'
            ? t('Update Location', 'تحديث الموقع')
            : t('Share Current Location', 'مشاركة الموقع الحالي')}
      </Button>
    </div>
  )
}

type FormState = {
  name: string
  slug: string
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
  locationLat: number | null
  locationLng: number | null
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
  catalogHidePrices: boolean
  supportsDineIn: boolean
  supportsReceiveInPerson: boolean
  supportsDelivery: boolean
  freeDeliveryEnabled: boolean
  supportsDriverPickup: boolean
  /** Delay before auto-requesting drivers on new orders (when “remember” is on). Null = none. */
  defaultAutoDeliveryRequestMinutes: number | null
  saveAutoDeliveryRequestPreference: boolean
  prioritizeWhatsapp: boolean
  openingHours: Array<{ open: string; close: string; shifts: { open: string; close: string }[] }>
  customDateHours: Array<{ date: string; open: string; close: string; shifts: { open: string; close: string }[] }>
}

function formSnapshotFromData(d: BusinessData, currentSlug: string): FormState {
  const tenant = d.tenant
  const r = d.restaurantInfo
  return {
    name: tenant?.name ?? '',
    slug: tenant?.slug ?? currentSlug,
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
    locationLat: tenant?.locationLat ?? null,
    locationLng: tenant?.locationLng ?? null,
    facebook: r?.socials?.facebook ?? '',
    instagram: r?.socials?.instagram ?? '',
    tiktok: r?.socials?.tiktok ?? '',
    snapchat: r?.socials?.snapchat ?? '',
    whatsapp: r?.socials?.whatsapp ?? '',
    website: r?.socials?.website ?? '',
    logoAssetId: r?.logoAssetId?.trim() ? r.logoAssetId.trim() : '',
    notificationSound: r?.notificationSound ?? '1.wav',
    deactivated: tenant?.deactivated ?? false,
    deactivateUntil: tenant?.deactivateUntil ?? '',
    defaultLanguage: tenant?.defaultLanguage ?? '',
    catalogMode: (tenant?.supportsDineIn === false && tenant?.supportsReceiveInPerson === false && tenant?.supportsDelivery === false),
    catalogHidePrices: tenant?.catalogHidePrices ?? false,
    supportsDineIn: tenant?.supportsDineIn ?? true,
    supportsReceiveInPerson: tenant?.supportsReceiveInPerson ?? true,
    supportsDelivery: tenant?.supportsDelivery ?? true,
    freeDeliveryEnabled: tenant?.freeDeliveryEnabled ?? false,
    supportsDriverPickup: tenant?.supportsDriverPickup ?? false,
    defaultAutoDeliveryRequestMinutes: (() => {
      const d = tenant?.defaultAutoDeliveryRequestMinutes
      if (d === undefined) return 20
      return d
    })(),
    saveAutoDeliveryRequestPreference: tenant?.saveAutoDeliveryRequestPreference ?? false,
    prioritizeWhatsapp: tenant?.prioritizeWhatsapp ?? false,
    openingHours: Array.isArray(r?.openingHours) && r.openingHours.length > 0
      ? Array.from({ length: 7 }, (_, i) => ({ 
          open: r!.openingHours![i]?.open ?? '', 
          close: r!.openingHours![i]?.close ?? '', 
          shifts: (r!.openingHours![i]?.shifts ?? []).map((s: any) => ({ open: s.open ?? '', close: s.close ?? '' })) 
        }))
      : Array.from({ length: 7 }, () => ({ open: '', close: '', shifts: [] })),
    customDateHours: Array.isArray(r?.customDateHours)
      ? r.customDateHours.filter((x: { date?: string }) => x?.date).map((x: { date?: string; open?: string; close?: string; shifts?: any[] }) => ({ 
          date: x.date ?? '', 
          open: x.open ?? '', 
          close: x.close ?? '', 
          shifts: (x.shifts ?? []).map((s: any) => ({ open: s.open ?? '', close: s.close ?? '' })) 
        }))
      : [],
  }
}

export function BusinessManageClient({ slug, menuUrl }: { slug: string; menuUrl?: string }) {
  const isStoreBusinessType = (value: string) => (STORE_BUSINESS_TYPES as readonly string[]).includes(value)
  const [data, setData] = useState<BusinessData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [countries, setCountries] = useState<CountryOption[]>([])
  const [cities, setCities] = useState<string[]>([])
  const [citiesLoading, setCitiesLoading] = useState(false)
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])
  const [subcategoriesLoading, setSubcategoriesLoading] = useState(false)
  const [businessCategory, setBusinessCategory] = useState<'restaurant' | 'stores'>('restaurant')
  const [form, setForm] = useState({
    name: '',
    slug: '',
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
    locationLat: null as number | null,
    locationLng: null as number | null,
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
    catalogHidePrices: false as boolean,
    supportsDineIn: true as boolean,
    supportsReceiveInPerson: true as boolean,
    supportsDelivery: true as boolean,
    freeDeliveryEnabled: false as boolean,
    supportsDriverPickup: false as boolean,
    defaultAutoDeliveryRequestMinutes: 20 as number | null,
    saveAutoDeliveryRequestPreference: false as boolean,
    prioritizeWhatsapp: false as boolean,
    openingHours: Array.from({ length: 7 }, () => ({ open: '', close: '', shifts: [] as { open: string; close: string }[] })),
    customDateHours: [] as Array<{ date: string; open: string; close: string; shifts?: { open: string; close: string }[] }>,
  })
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [logoUploading, setLogoUploading] = useState(false)
  const [setAllOpen, setSetAllOpen] = useState('')
  const [setAllClose, setSetAllClose] = useState('')
  const [cityMapCenter, setCityMapCenter] = useState<{ lat: number; lng: number } | null>(null)
  const [realtimeHealthLoading, setRealtimeHealthLoading] = useState(false)
  const [realtimeHealth, setRealtimeHealth] = useState<{
    ok: boolean
    checkedAt?: string
    pusher?: {
      configured?: boolean
      initialized?: boolean
      available?: boolean
      triggerOk?: boolean
      missingEnvKeys?: string[]
      lastInitErrorMessage?: string | null
    }
    notifications?: {
      fcmConfigured?: boolean
      webPushConfigured?: boolean
    }
    error?: string
  } | null>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const mountedRef = useRef(false)
  const countriesAbortRef = useRef<AbortController | null>(null)
  const citiesAbortRef = useRef<AbortController | null>(null)
  const geocodeAbortRef = useRef<AbortController | null>(null)
  const subcategoriesAbortRef = useRef<AbortController | null>(null)
  /** Snapshot of form when last saved (or when loaded); used to detect unsaved changes. */
  const lastSavedRef = useRef<typeof form | null>(null)
  /** When true, skip the next effect that applies context data (avoids overwriting form with stale refetch after save). */
  const skipNextApplyRef = useRef(false)
  const { showToast } = useToast()
  const { t, lang } = useLanguage()
  const businessContext = useTenantBusiness()

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      countriesAbortRef.current?.abort()
      citiesAbortRef.current?.abort()
      subcategoriesAbortRef.current?.abort()
      geocodeAbortRef.current?.abort()
    }
  }, [])

  const api = (path: string, options?: RequestInit) =>
    fetch(`/api/tenants/${slug}${path}`, { credentials: 'include', ...options, headers: { 'Content-Type': 'application/json', ...options?.headers } })

  // Load countries once (registration-only: Israel & Palestine for now)
  useEffect(() => {
    countriesAbortRef.current?.abort()
    const ac = new AbortController()
    countriesAbortRef.current = ac
    fetch('/api/countries?registration=1', { signal: ac.signal })
      .then((r) => r.json())
      .then((list) => {
        if (!mountedRef.current || ac.signal.aborted) return
        setCountries(Array.isArray(list) ? list : [])
      })
      .catch((err) => {
        if (isAbortError(err)) return
        if (!mountedRef.current) return
        setCountries([])
      })
    return () => ac.abort()
  }, [])

  // Load business data from the authoritative business API every time this page mounts.
  // Context data in manage layout can be partial (metadata-focused), which caused
  // fields like logo/subcategories/WhatsApp to appear cleared after navigation.
  useEffect(() => {
    const controller = new AbortController()
    const defaultGeo = { countryCode: null as string | null, countryName: null as string | null }

    const applyBusinessAndGeo = (d: BusinessData | null, geo: { countryCode?: string | null; countryName?: string | null }) => {
      setData(d ?? null)
      if (d?.tenant) {
        let country = d.tenant.country || ''
        const city = d.tenant.city || ''
        if (!country && geo?.countryCode) country = geo.countryCode
        setForm((f) => ({
          ...f,
          name: d.tenant!.name || '',
          slug: d.tenant!.slug ?? slug,
          businessType: d.tenant!.businessType || '',
          businessSubcategoryIds: Array.isArray(d.tenant!.businessSubcategoryIds) ? d.tenant!.businessSubcategoryIds : [],
          country,
          city,
          ownerPhone: d.tenant!.ownerPhone || '',
          deactivated: d.tenant!.deactivated ?? false,
          deactivateUntil: d.tenant!.deactivateUntil || '',
          defaultLanguage: d.tenant!.defaultLanguage || '',
          catalogMode: (d.tenant!.supportsDineIn === false && d.tenant!.supportsReceiveInPerson === false && d.tenant!.supportsDelivery === false),
          catalogHidePrices: d.tenant!.catalogHidePrices ?? false,
          supportsDineIn: d.tenant!.supportsDineIn ?? true,
          supportsReceiveInPerson: d.tenant!.supportsReceiveInPerson ?? true,
          supportsDelivery: d.tenant!.supportsDelivery ?? true,
          freeDeliveryEnabled: d.tenant!.freeDeliveryEnabled ?? false,
          supportsDriverPickup: d.tenant!.supportsDriverPickup ?? false,
          defaultAutoDeliveryRequestMinutes:
            d.tenant!.defaultAutoDeliveryRequestMinutes === undefined ? 20 : d.tenant!.defaultAutoDeliveryRequestMinutes,
          saveAutoDeliveryRequestPreference: d.tenant!.saveAutoDeliveryRequestPreference ?? false,
          prioritizeWhatsapp: d.tenant!.prioritizeWhatsapp ?? false,
          locationLat: d.tenant!.locationLat ?? null,
          locationLng: d.tenant!.locationLng ?? null,
        }))
        setBusinessCategory(isStoreBusinessType(d.tenant!.businessType || '') ? 'stores' : 'restaurant')
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
          facebook: r.socials?.facebook || '',
          instagram: r.socials?.instagram || '',
          tiktok: r.socials?.tiktok || '',
          snapchat: r.socials?.snapchat || '',
          whatsapp: r.socials?.whatsapp || '',
          website: r.socials?.website || '',
          logoAssetId: r.logoAssetId?.trim() ? r.logoAssetId.trim() : '',
          notificationSound: r.notificationSound || '1.wav',
          openingHours: Array.isArray(r.openingHours) && r.openingHours.length > 0
            ? Array.from({ length: 7 }, (_, i) => ({ 
                open: r.openingHours![i]?.open ?? '', 
                close: r.openingHours![i]?.close ?? '', 
                shifts: (r.openingHours![i]?.shifts ?? []).map((s: any) => ({ open: s.open ?? '', close: s.close ?? '' })) 
              }))
            : Array.from({ length: 7 }, () => ({ open: '', close: '', shifts: [] })),
          customDateHours: Array.isArray(r.customDateHours)
            ? r.customDateHours.filter((x: { date?: string }) => x?.date).map((x: { date?: string; open?: string; close?: string; shifts?: any[] }) => ({ 
                date: x.date ?? '', 
                open: x.open ?? '', 
                close: x.close ?? '', 
                shifts: (x.shifts ?? []).map((s: any) => ({ open: s.open ?? '', close: s.close ?? '' })) 
              }))
            : [],
        }))
        setLogoPreviewUrl(r.logoUrl || null)
      }
      if (d) {
        const snap = formSnapshotFromData(d, slug)
        if (geo?.countryCode && !snap.country) snap.country = geo.countryCode
        lastSavedRef.current = snap
      }
    }

    if (skipNextApplyRef.current) {
      skipNextApplyRef.current = false
    }

    setLoading(true)
    Promise.all([
      fetch(`/api/tenants/${encodeURIComponent(slug)}/business?refresh=1`, {
        credentials: 'include',
        signal: controller.signal,
      }).then((r) => r.json()),
      fetch('/api/geo', { signal: controller.signal }).then((r) => r.json()).catch(() => defaultGeo),
    ])
      .then(([d, geo]) => applyBusinessAndGeo(d as BusinessData, geo as typeof defaultGeo))
      .catch((err) => {
        if (isAbortError(err)) return
        if (!controller.signal.aborted) setLoading(false)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [slug])

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
    citiesAbortRef.current?.abort()
    if (!countryCode) {
      setCities([])
      setCitiesLoading(false)
      return
    }
    setCitiesLoading(true)
    const ac = new AbortController()
    citiesAbortRef.current = ac
    fetch(`/api/cities?country=${encodeURIComponent(countryCode)}`, { signal: ac.signal })
      .then((r) => r.json())
      .then((list) => {
        if (!mountedRef.current || ac.signal.aborted) return
        setCities(Array.isArray(list) ? list : [])
      })
      .catch((err) => {
        if (isAbortError(err)) return
        if (!mountedRef.current) return
        setCities([])
      })
      .finally(() => {
        if (mountedRef.current && !ac.signal.aborted) setCitiesLoading(false)
      })
  }, [])

  useEffect(() => {
    loadCities(form.country)
  }, [form.country, loadCities])

  // Auto-center map on selected city when no GPS location is set yet
  useEffect(() => {
    if (form.locationLat != null && form.locationLng != null) {
      setCityMapCenter(null)
      return
    }
    if (!form.country || !form.city) {
      setCityMapCenter(null)
      return
    }
    geocodeAbortRef.current?.abort()
    const ac = new AbortController()
    geocodeAbortRef.current = ac
    fetch(`/api/geocode-city?country=${encodeURIComponent(form.country)}&city=${encodeURIComponent(form.city)}`, {
      signal: ac.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!mountedRef.current || ac.signal.aborted || !data?.lat || !data?.lng) return
        setCityMapCenter({ lat: Number(data.lat), lng: Number(data.lng) })
      })
      .catch((err) => {
        if (isAbortError(err)) return
        if (mountedRef.current) setCityMapCenter(null)
      })
    return () => {
      ac.abort()
    }
  }, [form.country, form.city, form.locationLat, form.locationLng])

  useEffect(() => {
    subcategoriesAbortRef.current?.abort()
    if (!form.businessType || businessCategory === 'stores') {
      setSubcategories([])
      setSubcategoriesLoading(false)
      return
    }
    setSubcategoriesLoading(true)
    const ac = new AbortController()
    subcategoriesAbortRef.current = ac
    fetch(`/api/business-subcategories?businessType=${encodeURIComponent(form.businessType)}`, {
      signal: ac.signal,
      cache: 'no-store',
      credentials: 'include',
    })
      .then((r) => r.json())
      .then((data) => {
        if (!mountedRef.current || ac.signal.aborted) return
        setSubcategories(Array.isArray(data) ? data : [])
      })
      .catch((err) => {
        if (isAbortError(err)) return
        if (!mountedRef.current) return
        setSubcategories([])
      })
      .finally(() => {
        if (mountedRef.current && !ac.signal.aborted) setSubcategoriesLoading(false)
      })
  }, [form.businessType, businessCategory])

  const setBusinessType = (value: string) => {
    setBusinessCategory(isStoreBusinessType(value) ? 'stores' : 'restaurant')
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

  const runRealtimeHealthCheck = useCallback(async () => {
    setRealtimeHealthLoading(true)
    try {
      const res = await fetch('/api/health/realtime', {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
      })
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
      if (!res.ok) {
        const message = typeof data?.error === 'string' ? data.error : 'Realtime health check failed'
        setRealtimeHealth({ ok: false, error: message })
        showToast(message, 'فشل فحص حالة التحديث الفوري.', 'error')
        return
      }
      setRealtimeHealth({
        ok: Boolean(data.ok),
        checkedAt: typeof data.checkedAt === 'string' ? data.checkedAt : undefined,
        pusher: typeof data.pusher === 'object' && data.pusher ? (data.pusher as any) : undefined,
        notifications: typeof data.notifications === 'object' && data.notifications ? (data.notifications as any) : undefined,
      })
      showToast(
        Boolean(data.ok) ? 'Realtime health check passed.' : 'Realtime health check found issues.',
        Boolean(data.ok) ? 'فحص التحديث الفوري ناجح.' : 'فحص التحديث الفوري اكتشف مشاكل.',
        Boolean(data.ok) ? 'success' : 'error'
      )
    } catch {
      setRealtimeHealth({ ok: false, error: 'Network error while checking realtime health' })
      showToast('Network error while checking realtime health.', 'خطأ شبكة أثناء فحص التحديث الفوري.', 'error')
    } finally {
      setRealtimeHealthLoading(false)
    }
  }, [showToast])

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
    setLogoUploading(true)
    try {
      const compressed = await compressImageForUpload(file)
      if (compressed.size > MAX_IMAGE_BYTES) {
        showToast('Image is too large. Maximum size is 4 MB. Use a smaller or compressed image.', 'الصورة كبيرة جداً. الحد الأقصى 4 ميجابايت.', 'error')
        return
      }
      const fd = new FormData()
      fd.append('file', compressed)
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
      setLogoPreviewUrl(URL.createObjectURL(compressed))
    } catch {
      setLogoPreviewUrl(null)
      showToast('Upload failed. Try a smaller image.', 'فشل الرفع. جرب صورة أصغر.', 'error')
    } finally {
      setLogoUploading(false)
      if (logoInputRef.current) logoInputRef.current.value = ''
    }
  }

  const doSave = useCallback(async () => {
    const hasLogo = Boolean(logoPreviewUrl || form.logoAssetId?.trim())
    if (!hasLogo) {
      showToast('Please upload a business logo first.', 'يرجى رفع شعار العمل أولاً.', 'error')
      return
    }
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        businessType: form.businessType || undefined,
          businessSubcategoryIds: form.businessSubcategoryIds,
          country: form.country || undefined,
          city: form.city || undefined,
          ownerPhone: form.ownerPhone?.trim() || undefined,
          name_en: form.name_en || undefined,
          name_ar: form.name_ar || undefined,
          tagline_en: form.tagline_en || undefined,
          tagline_ar: form.tagline_ar || undefined,
          address_en: form.address_en || undefined,
          address_ar: form.address_ar || undefined,
          locationLat: form.locationLat,
          locationLng: form.locationLng,
          logoAssetId: form.logoAssetId || undefined,
          notificationSound: form.notificationSound || '1.wav',
          deactivated: form.deactivated,
          deactivateUntil: form.deactivateUntil || null,
          defaultLanguage: form.defaultLanguage || null,
          supportsDineIn: form.catalogMode ? false : form.supportsDineIn,
          supportsReceiveInPerson: form.catalogMode ? false : form.supportsReceiveInPerson,
          supportsDelivery: form.catalogMode ? false : form.supportsDelivery,
          freeDeliveryEnabled: form.catalogMode ? false : (form.supportsDelivery ? form.freeDeliveryEnabled : false),
          supportsDriverPickup: form.catalogMode ? false : form.supportsDriverPickup,
          ...(form.catalogMode || !form.supportsDelivery
            ? { defaultAutoDeliveryRequestMinutes: null, saveAutoDeliveryRequestPreference: false }
            : {
                defaultAutoDeliveryRequestMinutes: form.defaultAutoDeliveryRequestMinutes,
                saveAutoDeliveryRequestPreference: form.saveAutoDeliveryRequestPreference,
              }),
          catalogHidePrices: form.catalogMode ? form.catalogHidePrices : false,
          prioritizeWhatsapp: form.prioritizeWhatsapp,
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
        }
      if (form.slug && form.slug.trim() && form.slug.trim() !== slug) {
        payload.slugNew = form.slug.trim()
      }
      const res = await api('/business', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        const resData = (await res.json().catch(() => ({}))) as { redirectTo?: string }
        showToast('Business saved successfully.', 'تم حفظ البيانات بنجاح.', 'success')
        lastSavedRef.current = JSON.parse(JSON.stringify(form))
        skipNextApplyRef.current = true
        setData((prev) =>
          prev
            ? {
                ...prev,
                tenant: {
                  ...prev.tenant,
                  name: form.name,
                  slug: form.slug,
                  businessType: form.businessType,
                  businessSubcategoryIds: form.businessSubcategoryIds,
                  country: form.country,
                  city: form.city,
                  ownerPhone: form.ownerPhone,
                  deactivated: form.deactivated,
                  deactivateUntil: form.deactivateUntil || null,
                  defaultLanguage: form.defaultLanguage || null,
                  catalogHidePrices: form.catalogMode ? form.catalogHidePrices : false,
                  supportsDineIn: form.catalogMode ? false : form.supportsDineIn,
                  supportsReceiveInPerson: form.catalogMode ? false : form.supportsReceiveInPerson,
                  supportsDelivery: form.catalogMode ? false : form.supportsDelivery,
                  freeDeliveryEnabled: form.catalogMode ? false : (form.supportsDelivery ? form.freeDeliveryEnabled : false),
                  supportsDriverPickup: form.catalogMode ? false : form.supportsDriverPickup,
                  defaultAutoDeliveryRequestMinutes: form.catalogMode || !form.supportsDelivery ? null : form.defaultAutoDeliveryRequestMinutes,
                  saveAutoDeliveryRequestPreference: form.catalogMode || !form.supportsDelivery ? false : form.saveAutoDeliveryRequestPreference,
                  prioritizeWhatsapp: form.prioritizeWhatsapp,
                  locationLat: form.locationLat ?? undefined,
                  locationLng: form.locationLng ?? undefined,
                },
              }
            : null
        )
        void businessContext.refetch(true)
        if (resData?.redirectTo) {
          window.location.assign(resData.redirectTo)
          return
        }
      } else {
        const errData = (await res.json().catch(() => ({}))) as { error?: string; code?: string }
        if (errData?.code === 'MUST_VERIFY_PHONE') {
          const phone = (form.ownerPhone || '').trim()
          const params = new URLSearchParams({ returnTo: `/t/${slug}/manage/business` })
          if (phone) params.set('phone', phone.startsWith('+') ? phone : '+' + phone)
          window.location.href = `/verify-phone?${params.toString()}`
          return
        }
        const errMsg = typeof errData?.error === 'string' ? errData.error : undefined
        showToast(
          errMsg || 'Failed to save. Please try again.',
          errMsg || 'فشل الحفظ. يرجى المحاولة مرة أخرى.',
          'error'
        )
      }
    } catch {
      showToast('Failed to save. Please try again.', 'فشل الحفظ. يرجى المحاولة مرة أخرى.', 'error')
    } finally {
      setSaving(false)
    }
  }, [form, logoPreviewUrl, api, showToast, businessContext, slug])

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

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.08 }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 24 } }
  }

  if (loading) return <p className="text-slate-500 py-4 px-4">{t('Loading…', 'جارٍ التحميل…')}</p>

  return (
    <div className="relative pb-32 md:pb-12">
    <motion.div 
      className="space-y-6 md:space-y-8 max-w-3xl mx-auto"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={itemVariants} className="px-2 md:px-0 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black md:text-3xl tracking-tight text-white">{t('Manage Business', 'إدارة العمل')}</h1>
          <p className="mt-2 text-slate-400 text-sm md:text-base leading-relaxed">
            {t(
              'Edit your store name, country & city (for delivery), and store details shown on your menu page.',
              'عدّل اسم المتجر والبلد والمدينة (للتوصيل)، وتفاصيل المتجر المعروضة على صفحة القائمة.'
            )}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white shrink-0"
          onClick={() => businessContext.refetch(true)}
          disabled={businessContext.loading}
          title={t('Refresh data', 'تحديث البيانات')}
        >
          <RefreshCw className="mr-2 size-4" />
          {t('Refresh', 'تحديث')}
        </Button>
      </motion.div>

      {/* Menu QR Code — only on Business Profile */}
      {menuUrl && (
        <motion.div variants={itemVariants} className="px-2 md:px-0 max-w-[320px]">
          <TenantQRCode menuUrl={menuUrl} slug={slug} />
        </motion.div>
      )}

      {/* Schedule & availability: manual open/close + weekly hours */}
      <motion.div variants={itemVariants} className="w-full rounded-3xl border border-slate-800/60 bg-slate-900/60 p-5 sm:p-6 md:p-8 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400">
            <Clock className="h-6 w-6 shrink-0" />
          </div>
          <div>
            <h2 className="font-bold text-white text-lg md:text-xl tracking-tight">{t('Schedule & availability', 'الجدول والتوفر')}</h2>
            <p className="text-xs text-slate-400 mt-1">
              {t('Manual open/close overrides your weekly hours.', 'الفتح/الإغلاق اليدوي يتجاوز ساعاتك الأسبوعية.')}
            </p>
          </div>
        </div>
        
        <div className="mb-6">
          <p className="mb-3 text-sm font-semibold text-slate-300">{t('Business status', 'حالة المتجر')}</p>
          <div className="flex w-full justify-center">
            <motion.button
              type="button"
              onClick={() => setForm((f) => ({ ...f, deactivated: !f.deactivated, ...(f.deactivated ? {} : { deactivateUntil: '' }) }))}
              className={
                'touch-manipulation rounded-2xl font-black text-base transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-500/50 flex min-h-[64px] items-center justify-center overflow-hidden shadow-lg ' +
                (!form.deactivated
                  ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 active:bg-emerald-600 shadow-emerald-500/20 border border-emerald-400/50'
                  : 'bg-slate-800 text-slate-200 hover:bg-slate-700 active:bg-slate-900 border-2 border-slate-600')
              }
              initial={false}
              animate={{ width: availabilityExpanded ? '100%' : '8rem' }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            >
              <span className="px-5 py-3">
                <AnimatePresence mode="wait">
                  {availabilityExpanded ? (
                    <motion.span key="expanded" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="flex items-center justify-center gap-2 truncate">
                      {!form.deactivated && <span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-950 opacity-40"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-slate-950"></span></span>}
                      {!form.deactivated ? t('Business is Open', 'المتجر مفتوح الآن') : t('Business is Closed', 'المتجر مغلق الآن')}
                    </motion.span>
                  ) : (
                    <motion.span key="compact" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="flex items-center justify-center gap-2">
                      {!form.deactivated && <span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-950 opacity-40"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-slate-950"></span></span>}
                      {!form.deactivated ? t('Open', 'مفتوح') : t('Closed', 'مغلق')}
                    </motion.span>
                  )}
                </AnimatePresence>
              </span>
            </motion.button>
          </div>
          {form.deactivated && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-5 rounded-2xl bg-slate-800/50 border border-slate-700/50 p-4">
              <label className="mb-2 block text-sm font-semibold text-slate-300">{t('Re-open at (date & time)', 'إعادة الفتح في (التاريخ والوقت)')}</label>
              <Input
                type="datetime-local"
                value={form.deactivateUntil ? (() => {
                  const d = new Date(form.deactivateUntil)
                  const pad = (n: number) => String(n).padStart(2, '0')
                  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
                })() : ''}
                onChange={(e) => setForm((f) => ({ ...f, deactivateUntil: e.target.value ? new Date(e.target.value).toISOString() : '' }))}
                className="w-full sm:max-w-xs h-14 rounded-xl bg-slate-900 border-slate-600 text-white px-4 text-base"
              />
              <p className="mt-2 text-xs text-slate-400">{t('Optional. Leave empty to stay closed until you turn it back on.', 'اختياري. اتركه فارغاً للبقاء مغلقاً حتى تعيد التفعيل.')}</p>
            </motion.div>
          )}
        </div>
        {/* Opening hours — same card as schedule */}
        <div className="mt-8 pt-6 border-t border-slate-800">
          <h3 className="mb-2 font-bold text-white text-base md:text-lg">{t('Weekly opening hours', 'ساعات العمل الأسبوعية')}</h3>
          <p className="mb-5 text-sm text-slate-400">
            {t('Set your business hours per day (Sunday–Saturday). Shown on your menu. Leave empty for closed.', 'حدد ساعات العمل لكل يوم (الأحد–السبت). تظهر على قائمتك. اترك فارغاً للإغلاق.')}
          </p>
          <div className="space-y-6">
            <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-700/50 bg-slate-800/40 p-4">
              <span className="text-sm font-semibold text-slate-300 w-full mb-1">{t('Change all days at once', 'تغيير كل الأيام مرة واحدة')}:</span>
              <div className="flex flex-wrap items-center gap-3 w-full">
                <Input
                  type="time"
                  className="w-32 h-12 rounded-xl bg-slate-900 border-slate-600 text-white"
                  value={setAllOpen}
                  onChange={(e) => setSetAllOpen(e.target.value)}
                />
                <Input
                  type="time"
                  className="w-32 h-12 rounded-xl bg-slate-900 border-slate-600 text-white"
                  value={setAllClose}
                  onChange={(e) => setSetAllClose(e.target.value)}
                />
                <Button
                  type="button"
                  variant="secondary"
                  className="h-12 rounded-xl px-5 font-semibold bg-slate-700 text-white hover:bg-slate-600"
                  onClick={() => setForm((f) => ({ ...f, openingHours: Array(7).fill(null).map(() => ({ open: setAllOpen, close: setAllClose, shifts: setAllOpen || setAllClose ? [{ open: setAllOpen, close: setAllClose }] : [] })) }))}
                >
                  {t('Apply to all days', 'تطبيق على كل الأيام')}
                </Button>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-xl border-slate-600 bg-slate-900 text-slate-300 hover:text-white"
                onClick={() => setForm((f) => ({ ...f, openingHours: Array(7).fill(null).map(() => ({ open: '', close: '', shifts: [] })) }))}
              >
                {t('Clear all hours', 'مسح كل الساعات')}
              </Button>
            </div>
            
            <div className="space-y-3">
              {[
                t('Sunday', 'الأحد'),
                t('Monday', 'الاثنين'),
                t('Tuesday', 'الثلاثاء'),
                t('Wednesday', 'الأربعاء'),
                t('Thursday', 'الخميس'),
                t('Friday', 'الجمعة'),
                t('Saturday', 'السبت'),
              ].map((dayLabel, i) => {
                const dayData = form.openingHours[i]
                const shifts = dayData.shifts?.length ? dayData.shifts : (dayData.open || dayData.close ? [{ open: dayData.open, close: dayData.close }] : [])
                
                return (
                  <div key={i} className="bg-slate-800/30 rounded-xl p-3 sm:p-4 border border-slate-700/50">
                    <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                      <div className="w-full sm:w-28 pt-2">
                        <span className="font-semibold text-slate-200">{dayLabel}</span>
                      </div>
                      <div className="flex-1 space-y-3">
                        <AnimatePresence>
                          {shifts.map((shift, shiftIdx) => (
                            <motion.div key={shiftIdx} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex items-center gap-2 overflow-hidden">
                              <Input
                                type="time"
                                className="w-28 sm:w-32 h-11 rounded-xl bg-slate-900 border-slate-700 focus:border-amber-500 text-white"
                                value={shift.open}
                                onChange={(e) => {
                                  const newShifts = [...shifts]
                                  newShifts[shiftIdx] = { ...newShifts[shiftIdx], open: e.target.value }
                                  setForm(f => ({
                                    ...f,
                                    openingHours: f.openingHours.map((d, j) => j === i ? { ...d, open: newShifts[0]?.open || '', close: newShifts[0]?.close || '', shifts: newShifts } : d)
                                  }))
                                }}
                              />
                              <span className="text-slate-500">-</span>
                              <Input
                                type="time"
                                className="w-28 sm:w-32 h-11 rounded-xl bg-slate-900 border-slate-700 focus:border-amber-500 text-white"
                                value={shift.close}
                                onChange={(e) => {
                                  const newShifts = [...shifts]
                                  newShifts[shiftIdx] = { ...newShifts[shiftIdx], close: e.target.value }
                                  setForm(f => ({
                                    ...f,
                                    openingHours: f.openingHours.map((d, j) => j === i ? { ...d, open: newShifts[0]?.open || '', close: newShifts[0]?.close || '', shifts: newShifts } : d)
                                  }))
                                }}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-11 w-11 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 shrink-0"
                                onClick={() => {
                                  const newShifts = shifts.filter((_, idx) => idx !== shiftIdx)
                                  setForm(f => ({
                                    ...f,
                                    openingHours: f.openingHours.map((d, j) => j === i ? { ...d, open: newShifts[0]?.open || '', close: newShifts[0]?.close || '', shifts: newShifts } : d)
                                  }))
                                }}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </motion.div>
                          ))}
                        </AnimatePresence>
                        <div className="flex items-center justify-between mt-2">
                          <Button
                            type="button"
                            variant="ghost"
                            className="text-amber-500 hover:bg-amber-500/10 hover:text-amber-400 px-3 h-9 text-sm font-semibold rounded-lg"
                            onClick={() => {
                              const newShifts = [...shifts, { open: '', close: '' }]
                              setForm(f => ({
                                ...f,
                                openingHours: f.openingHours.map((d, j) => j === i ? { ...d, open: newShifts[0]?.open || '', close: newShifts[0]?.close || '', shifts: newShifts } : d)
                              }))
                            }}
                          >
                            + {t('Add shift', 'إضافة فترة')}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            className="text-blue-400 hover:bg-blue-500/10 hover:text-blue-300 px-3 h-9 text-sm font-semibold rounded-lg"
                            onClick={() => {
                              setForm(f => ({
                                ...f,
                                openingHours: f.openingHours.map(d => ({ ...d, open: shifts[0]?.open || '', close: shifts[0]?.close || '', shifts: JSON.parse(JSON.stringify(shifts)) }))
                              }))
                              showToast('Copied to all days', 'تم النسخ لكل الأيام', 'success')
                            }}
                          >
                            {t('Copy to all days', 'نسخ لكل الأيام')}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <div>
              <p className="mb-3 text-sm font-semibold text-slate-300">{t('Custom dates (e.g. holidays)', 'تواريخ مخصصة (مثلاً العطل)')}</p>
              <div className="space-y-3">
                <AnimatePresence>
                  {form.customDateHours.map((custom, idx) => (
                    <motion.div key={idx} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex flex-wrap items-center gap-3 bg-slate-800/40 p-3 rounded-2xl border border-slate-700/50">
                      <Input
                        type="date"
                        className="w-full sm:w-40 h-12 rounded-xl bg-slate-900 border-slate-600 text-white"
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
                        className="w-32 h-12 rounded-xl bg-slate-900 border-slate-600 text-white"
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
                        className="w-32 h-12 rounded-xl bg-slate-900 border-slate-600 text-white"
                        value={custom.close}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            customDateHours: f.customDateHours.map((c, j) => (j === idx ? { ...c, close: e.target.value } : c)),
                          }))
                        }
                      />
                      <Button type="button" variant="ghost" className="h-12 w-12 rounded-xl text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 p-0" onClick={() => setForm((f) => ({ ...f, customDateHours: f.customDateHours.filter((_, j) => j !== idx) }))}>
                        <Trash2 className="size-5" />
                      </Button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
              <Button
                type="button"
                variant="outline"
                className="mt-4 h-12 rounded-xl border-dashed border-slate-600 bg-transparent text-slate-300 hover:bg-slate-800 hover:text-white font-semibold"
                onClick={() => setForm((f) => ({ ...f, customDateHours: [...f.customDateHours, { date: '', open: '', close: '' }] }))}
              >
                + {t('Add custom date', 'إضافة تاريخ مخصص')}
              </Button>
            </div>
          </div>
        </div>
      </motion.div>

      <motion.form variants={itemVariants} onSubmit={handleSubmit} className="mt-8 max-w-3xl space-y-8 rounded-3xl border border-slate-800/60 bg-slate-900/40 p-5 sm:p-6 md:p-8 shadow-sm">
        {/* Default language + Order types - near top of form */}
        <div className="dashboard-section">
          <h2 className="mb-4 font-bold text-white text-lg md:text-xl tracking-tight">{t('Dashboard language & order types', 'لغة لوحة التحكم وأنواع الطلب')}</h2>
          <div className="space-y-6">
            <div className="rounded-2xl bg-slate-800/40 border border-slate-700/50 p-4 sm:p-5">
              <label className="block text-sm font-semibold text-slate-300 mb-2">{t('Default language (your dashboard)', 'اللغة الافتراضية (لوحة التحكم)')}</label>
              <select
                value={form.defaultLanguage || 'ar'}
                onChange={(e) => setForm((f) => ({ ...f, defaultLanguage: e.target.value }))}
                className="w-full sm:max-w-xs h-14 rounded-xl border border-slate-600 bg-slate-900 text-white px-4 text-base focus:ring-2 focus:ring-amber-500/50 outline-none"
              >
                <option value="ar">{t('Arabic', 'العربية')}</option>
                <option value="en">{t('English', 'English')}</option>
              </select>
              <p className="mt-2 text-xs text-slate-400">{t('Language for manage pages. Customer menu language is chosen by the customer.', 'لغة صفحات الإدارة. لغة قائمة العملاء يختارها العميل.')}</p>
            </div>
            <div className="rounded-2xl bg-slate-800/40 border border-slate-700/50 p-4 sm:p-5">
              <p className="block text-sm font-semibold text-slate-300 mb-2">{t('Catalog?', 'كتالوج فقط؟')}</p>
              <p className="mb-4 text-sm text-slate-400 max-w-xl leading-relaxed">
                {t(
                  'Choose "Yes" if you only want to show your menu online — no ordering, no cart, no delivery. Customers can browse items and prices only. Ideal for displaying your offer, sharing your menu link, or when you take orders by phone or elsewhere. Choose "No" when you want customers to place orders through this site (dine-in, pickup, or delivery).',
                  'اختر "نعم" إذا أردت عرض قائمتك فقط على الإنترنت — بدون طلبات أو سلة أو توصيل. يمكن للعملاء تصفح المنتجات والأسعار فقط. مناسب لعرض العروض أو مشاركة رابط القائمة أو عندما تستقبل الطلبات هاتفياً أو عبر قنوات أخرى. اختر "لا" عندما تريد أن يقدّم العملاء الطلبات عبر الموقع (تناول في المكان أو استلام شخصي أو توصيل).'
                )}
              </p>
              <div className="mb-4 flex flex-wrap gap-4">
                <label className="flex flex-1 sm:flex-none cursor-pointer items-center gap-3 rounded-xl border border-slate-700/80 bg-slate-900 px-5 py-4 has-[:checked]:border-amber-500/60 has-[:checked]:bg-amber-500/10 transition-colors">
                  <input
                    type="radio"
                    name="catalogMode"
                    checked={form.catalogMode === true}
                    onChange={() => setForm((f) => ({ ...f, catalogMode: true, supportsDineIn: false, supportsReceiveInPerson: false, supportsDelivery: false, supportsDriverPickup: false }))}
                    className="size-5 border-slate-600 bg-slate-800 accent-amber-500"
                  />
                  <span className="text-sm font-bold text-white">{t('Yes — menu is view-only', 'نعم — القائمة للعرض فقط')}</span>
                </label>
                <label className="flex flex-1 sm:flex-none cursor-pointer items-center gap-3 rounded-xl border border-slate-700/80 bg-slate-900 px-5 py-4 has-[:checked]:border-amber-500/60 has-[:checked]:bg-amber-500/10 transition-colors">
                  <input
                    type="radio"
                    name="catalogMode"
                    checked={form.catalogMode === false}
                    onChange={() => setForm((f) => ({ ...f, catalogMode: false, supportsDineIn: f.supportsDineIn || true, supportsReceiveInPerson: f.supportsReceiveInPerson || true, supportsDelivery: f.supportsDelivery || true, supportsDriverPickup: f.supportsDelivery ? f.supportsDriverPickup : false }))}
                    className="size-5 border-slate-600 bg-slate-800 accent-amber-500"
                  />
                  <span className="text-sm font-bold text-white">{t('No — accept orders', 'لا — قبول الطلبات')}</span>
                </label>
              </div>

              <AnimatePresence>
                {form.catalogMode && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-4 overflow-hidden"
                  >
                    <label className="flex items-start sm:items-center gap-3 cursor-pointer rounded-xl border border-slate-700/80 bg-slate-900 px-5 py-4 has-[:checked]:border-amber-500/60 has-[:checked]:bg-amber-500/10 transition-colors">
                      <input
                        type="checkbox"
                        checked={form.catalogHidePrices}
                        onChange={(e) => setForm(f => ({ ...f, catalogHidePrices: e.target.checked }))}
                        className="mt-0.5 sm:mt-0 size-5 rounded border-slate-600 bg-slate-800 accent-amber-500 shrink-0"
                      />
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-bold text-white leading-none">
                          {t('Hide prices from customers', 'إخفاء الأسعار عن العملاء')}
                        </span>
                        <span className="text-xs text-slate-400">
                          {t('When checked, all product prices will be hidden in catalog mode.', 'عند التفعيل، سيتم إخفاء جميع أسعار المنتجات في وضع الكتالوج.')}
                        </span>
                      </div>
                    </label>
                  </motion.div>
                )}
              </AnimatePresence>

              {form.catalogMode ? (
                <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-4">
                  <p className="text-sm text-sky-200">
                    {t('Catalog mode is on: your menu link shows items and prices only — no Add to Cart or checkout. Dine-in, Receive in Person, and Delivery are disabled.', 'وضع الكتالوج مفعّل: رابط قائمتك يعرض المنتجات والأسعار فقط — بدون إضافة إلى السلة أو دفع. تناول في المكان واستلام شخصي والتوصيل معطّلان.')}
                  </p>
                </div>
              ) : (
                <div className="mt-6 pt-4 border-t border-slate-700/60">
                  <p className="block text-sm font-semibold text-slate-300 mb-3">{t('Accept these order types', 'قبول أنواع الطلب التالية')}</p>
                  <div className="space-y-3">
                    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-700/80 bg-slate-900 px-4 py-3.5 transition-colors hover:bg-slate-800">
                      <input
                        type="checkbox"
                        checked={form.supportsDineIn}
                        onChange={(e) => setForm((f) => ({ ...f, supportsDineIn: e.target.checked }))}
                        className="size-5 rounded border-slate-600 bg-slate-800 accent-amber-500"
                      />
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-fuchsia-500/20 text-fuchsia-400">
                        <UtensilsCrossed className="size-4" />
                      </div>
                      <span className="text-sm font-semibold text-white">{t('Dine-in (order at table)', 'تناول في المكان (طلب على الطاولة)')}</span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-700/80 bg-slate-900 px-4 py-3.5 transition-colors hover:bg-slate-800">
                      <input
                        type="checkbox"
                        checked={form.supportsReceiveInPerson}
                        onChange={(e) => setForm((f) => ({ ...f, supportsReceiveInPerson: e.target.checked }))}
                        className="size-5 rounded border-slate-600 bg-slate-800 accent-amber-500"
                      />
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
                        <Store className="size-4" />
                      </div>
                      <span className="text-sm font-semibold text-white">{t('Receive in Person (pickup)', 'استلام شخصي (من المتجر)')}</span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-700/80 bg-slate-900 px-4 py-3.5 transition-colors hover:bg-slate-800">
                      <input
                        type="checkbox"
                        checked={form.supportsDelivery}
                        onChange={(e) => setForm((f) => ({ ...f, supportsDelivery: e.target.checked, freeDeliveryEnabled: e.target.checked ? f.freeDeliveryEnabled : false, supportsDriverPickup: e.target.checked ? f.supportsDriverPickup : false }))}
                        className="size-5 rounded border-slate-600 bg-slate-800 accent-amber-500"
                      />
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/20 text-sky-400">
                        <MapPin className="size-4" />
                      </div>
                      <span className="text-sm font-semibold text-white">{t('Delivery', 'التوصيل')}</span>
                    </label>
                    <label className={`flex items-start gap-3 rounded-xl border border-slate-700/80 bg-slate-900 px-4 py-3.5 transition-colors ${form.supportsDelivery ? 'cursor-pointer hover:bg-slate-800' : 'opacity-60 cursor-not-allowed'}`}>
                      <input
                        type="checkbox"
                        checked={form.freeDeliveryEnabled}
                        disabled={!form.supportsDelivery}
                        onChange={(e) => setForm((f) => ({ ...f, freeDeliveryEnabled: e.target.checked }))}
                        className="mt-0.5 size-5 rounded border-slate-600 bg-slate-800 accent-amber-500 disabled:opacity-60"
                      />
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
                        <MapPin className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white">{t('Free Delivery (business pays driver)', 'توصيل مجاني (المتجر يدفع للسائق)')}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {t('Customer sees "Free Delivery". Driver still receives delivery fee from your business.', 'العميل يرى "توصيل مجاني". السائق يستلم رسوم التوصيل من متجرك.')}
                        </p>
                      </div>
                    </label>
                    <label className={`flex items-center gap-3 rounded-xl border border-slate-700/80 bg-slate-900 px-4 py-3.5 transition-colors ${form.supportsDelivery ? 'cursor-pointer hover:bg-slate-800' : 'opacity-60 cursor-not-allowed'}`}>
                      <input
                        type="checkbox"
                        checked={form.supportsDriverPickup}
                        disabled={!form.supportsDelivery}
                        onChange={(e) => setForm((f) => ({ ...f, supportsDriverPickup: e.target.checked }))}
                        className="size-5 rounded border-slate-600 bg-slate-800 accent-amber-500 disabled:opacity-60"
                      />
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400">
                        <Store className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white">{t('Driver Pickup (auto dispatch)', 'استلام السائق (إرسال تلقائي)')}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {t('For manual-collection stores. New delivery orders are sent to drivers automatically, no manual request needed.', 'للمتاجر التي تحتاج تجميع يدوي. طلبات التوصيل الجديدة تُرسل للسائقين تلقائياً بدون طلب يدوي.')}
                        </p>
                      </div>
                    </label>
                    <div
                      className={`rounded-xl border border-slate-700/80 bg-slate-900 p-4 transition-colors ${
                        form.supportsDelivery ? '' : 'opacity-60 pointer-events-none'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/20 text-blue-300">
                          <Timer className="size-4" />
                        </div>
                        <div className="min-w-0 flex-1 space-y-3">
                          <div>
                            <p className="text-sm font-semibold text-white">
                              {t('Auto-request drivers after', 'طلب السائقين تلقائياً بعد')}
                            </p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {t(
                                'Default delay when a new delivery order appears. You can change per order on the orders screen.',
                                'المدة الافتراضية عند وصول طلب توصيل جديد. يمكنك تغييرها لكل طلب من شاشة الطلبات.'
                              )}
                            </p>
                          </div>
                          <select
                            value={form.defaultAutoDeliveryRequestMinutes === null ? 'none' : String(form.defaultAutoDeliveryRequestMinutes)}
                            disabled={!form.supportsDelivery}
                            onChange={(e) => {
                              const v = e.target.value
                              setForm((f) => ({
                                ...f,
                                defaultAutoDeliveryRequestMinutes: v === 'none' ? null : Number(v),
                              }))
                            }}
                            className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2.5 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                          >
                            {AUTO_DELIVERY_DROPDOWN_SEQUENCE.map((entry) => (
                              <option key={entry === 'none' ? 'none' : entry} value={entry === 'none' ? 'none' : String(entry)} className="bg-slate-900">
                                {entry === 'none'
                                  ? t('None (manual only)', 'بدون (يدوي فقط)')
                                  : entry === 0
                                    ? t('Immediately', 'فوراً')
                                    : t(`${entry} minutes`, `${entry} دقيقة`)}
                              </option>
                            ))}
                          </select>
                          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-200">
                            <input
                              type="checkbox"
                              checked={form.saveAutoDeliveryRequestPreference}
                              disabled={!form.supportsDelivery}
                              onChange={(e) =>
                                setForm((f) => ({ ...f, saveAutoDeliveryRequestPreference: e.target.checked }))
                              }
                              className="size-4 rounded border-slate-600 bg-slate-800 accent-amber-500"
                            />
                            {t('Remember this for new orders', 'تذكر هذا للطلبات الجديدة')}
                          </label>
                        </div>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-slate-400">
                      {t('Customers see Delivery only when this is checked and you have at least one delivery area.', 'يرى العملاء خيار التوصيل فقط عند تفعيله هنا مع وجود منطقة توصيل واحدة على الأقل.')}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="dashboard-section pt-6 border-t border-slate-800">
          <h2 className="mb-4 font-bold text-white text-lg md:text-xl tracking-tight">{t('Store identity', 'هوية المتجر')}</h2>
          <div className="space-y-6">
            <div className="rounded-2xl bg-slate-800/40 border border-slate-700/50 p-4 sm:p-5">
              <label className="block text-sm font-semibold text-slate-300 mb-3">{t('Business logo', 'شعار العمل')} *</label>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
                <div className="flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-slate-600 border-dashed bg-slate-900">
                  {logoPreviewUrl ? (
                    <img src={logoPreviewUrl} alt="Logo" className="size-full object-contain p-2" />
                  ) : (
                    <ImageIcon className="size-10 text-slate-500" />
                  )}
                </div>
                <div className="flex flex-col gap-3">
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
                    className="h-12 rounded-xl px-6 font-semibold border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white"
                    onClick={() => logoInputRef.current?.click()}
                    disabled={logoUploading}
                  >
                    <Upload className="mr-2 size-5" />
                    {logoUploading ? t('Uploading…', 'جارٍ الرفع…') : logoPreviewUrl ? t('Change logo', 'تغيير الشعار') : t('Upload logo', 'رفع شعار')}
                  </Button>
                  <p className="text-xs text-slate-400">{t('Required. JPEG, PNG, WebP or GIF. Shown on your menu and PWA.', 'مطلوب. JPEG أو PNG أو WebP أو GIF. يظهر في القائمة والتطبيق.')}</p>
                  <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs leading-relaxed text-amber-200/90">
                    <strong>{t('App icon', 'أيقونة التطبيق')}:</strong> {t('To show your logo when someone adds your menu to their home screen, they must use your menu link. If the icon still shows the old image, remove the app from the home screen and add it again from that link.', 'لعرض شعارك عند إضافة القائمة للشاشة الرئيسية، يجب استخدام رابط القائمة. إن ظهرت الصورة القديمة، احذف التطبيق من الشاشة الرئيسية وأضفه مرة أخرى من الرابط.')}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="rounded-2xl bg-slate-800/40 border border-slate-700/50 p-4 sm:p-5">
              <label className="block text-sm font-semibold text-slate-300 mb-2">{t('Store name', 'اسم المتجر')} *</label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full h-14 rounded-xl bg-slate-900 border-slate-600 text-white px-4 text-base"
                required
              />
              <p className="mt-2 text-xs text-slate-400">{t('Shown in the header of your menu (e.g. B Cafe).', 'يظهر في رأس القائمة (مثال: مقهى ب).')}</p>
            </div>

            <div className="rounded-2xl bg-slate-800/40 border border-slate-700/50 p-4 sm:p-5">
              <label className="block text-sm font-semibold text-slate-300 mb-2">{t('Business URL', 'رابط المتجر')}</label>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-slate-500 shrink-0">/t/</span>
                <Input
                  value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-') }))}
                  placeholder="my-restaurant"
                  className="flex-1 min-w-[140px] h-14 rounded-xl bg-slate-900 border-slate-600 text-white px-4 text-base font-mono"
                />
              </div>
              <p className="mt-2 text-xs text-slate-400">
                {t(
                  'Your menu link. Letters, numbers, and hyphens only. Changing it will update your public URL.',
                  'رابط قائمتك. أحرف وأرقام وشرطات فقط. تغييره يحدّث رابطك العام.'
                )}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-800/40 border border-slate-700/50 p-4 sm:p-5">
              <label className="block text-sm font-semibold text-slate-300 mb-2">{t('Business category', 'التصنيف الرئيسي')} *</label>
              <select
                value={businessCategory}
                onChange={(e) => {
                  const next = e.target.value === 'stores' ? 'stores' : 'restaurant'
                  setBusinessCategory(next)
                  if (next === 'restaurant') {
                    setForm((f) => ({ ...f, businessType: 'restaurant', businessSubcategoryIds: [] }))
                    return
                  }
                  setForm((f) => ({ ...f, businessType: '', businessSubcategoryIds: [] }))
                }}
                className="w-full sm:max-w-md h-14 rounded-xl border border-slate-600 bg-slate-900 text-white px-4 text-base focus:ring-2 focus:ring-amber-500/50 outline-none"
                required
              >
                {BUSINESS_CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {lang === 'ar' ? opt.labelAr : opt.label}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-slate-400">{t('Choose Restaurant or Store. Then choose the matching sub-category.', 'اختر مطعم أو متجر، ثم اختر التصنيف الفرعي المناسب.')}</p>

              {businessCategory === 'stores' && (
                <div className="mt-5 pt-5 border-t border-slate-700/60">
                  <label className="block text-sm font-semibold text-slate-300 mb-3">{t('Store sub-categories', 'تصنيفات المتجر')}</label>
                  <div className="flex flex-wrap gap-2">
                    {STORE_BUSINESS_TYPES.filter((value) =>
                      ['grocery', 'greengrocer', 'pharmacy', 'bakery', 'butcher', 'water', 'gas', 'supermarket', 'retail', 'other'].includes(value)
                    ).map((value) => {
                      const labels = BUSINESS_TYPES.find((x) => x.value === value)
                      const checked = form.businessType === value
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setBusinessType(value)}
                          className={`rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
                            checked
                              ? 'border-amber-500/60 bg-amber-500/20 text-amber-300'
                              : 'border-slate-600 bg-slate-900 text-slate-300 hover:border-slate-500 hover:bg-slate-800'
                          }`}
                        >
                          {lang === 'ar' ? labels?.labelAr ?? value : labels?.label ?? value}
                        </button>
                      )
                    })}
                  </div>
                  <p className="mt-3 text-xs text-slate-400">{t('Choose one: Grocery, Greengrocery, Pharmacy, Bakery, Butcher, Water, Gas, etc.', 'اختر واحداً: بقالة، خضار وفواكه، صيدلية، مخبز، ملحمة، ماء، غاز...')}</p>
                </div>
              )}
              
              {form.businessType && (
                <div className="mt-5 pt-5 border-t border-slate-700/60">
                  <label className="block text-sm font-semibold text-slate-300 mb-3">{t('Sub-categories (specialties)', 'التصنيفات الفرعية (التخصصات)')}</label>
                  {subcategoriesLoading ? (
                    <p className="text-sm text-slate-500">{t('Loading…', 'جاري التحميل…')}</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {subcategories.map((sub) => {
                        const checked = (form.businessSubcategoryIds || []).includes(sub._id)
                        return (
                          <label key={sub._id} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${checked ? 'border-amber-500/60 bg-amber-500/20 text-amber-300' : 'border-slate-600 bg-slate-900 text-slate-300 hover:border-slate-500 hover:bg-slate-800'}`}>
                            <input type="checkbox" checked={checked} onChange={() => toggleSubcategory(sub._id)} className="rounded accent-amber-500 size-4" />
                            {lang === 'ar' ? (sub.title_ar || sub.title_en) : (sub.title_en || sub.title_ar)}
                          </label>
                        )
                      })}
                      {subcategories.length === 0 && <p className="text-sm text-slate-500">{t('No sub-categories yet. Add them in Sanity Studio.', 'لا توجد تصنيفات فرعية بعد.')}</p>}
                    </div>
                  )}
                  <p className="mt-3 text-xs text-slate-400">{t('Select all that apply. e.g. Burgers, Sandwiches, Pizza.', 'اختر كل ما ينطبق. مثال: برجر، شطائر، بيتزا.')}</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-2xl bg-slate-800/40 border border-slate-700/50 p-4 sm:p-5">
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">{t('Country', 'البلد')} *</label>
                <select
                  value={form.country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full h-14 rounded-xl border border-slate-600 bg-slate-900 text-white px-4 text-base focus:ring-2 focus:ring-amber-500/50 outline-none"
                  required
                >
                  <option value="">{t('Select country', 'اختر البلد')}</option>
                  {countries.map((c) => (
                    <option key={c.code} value={c.code}>
                      {lang === 'ar' ? (getCountryNameAr(c.code) ?? c.name) : c.name}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-slate-400">{t('Required for drivers by area. Auto-detected from your location.', 'مطلوب للسائقين حسب المنطقة. يُكتشف تلقائياً من موقعك.')}</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">{t('City', 'المدينة')} *</label>
                <select
                  value={form.city}
                  onChange={(e) => setCity(e.target.value)}
                  disabled={!form.country || citiesLoading}
                  className="w-full h-14 rounded-xl border border-slate-600 bg-slate-900 text-white px-4 text-base focus:ring-2 focus:ring-amber-500/50 outline-none disabled:opacity-50"
                  required
                >
                  <option value="">{t('Select city', 'اختر المدينة')}</option>
                  {cities.map((name) => (
                    <option key={name} value={name}>
                      {lang === 'ar' ? (getCityNameAr(name) ?? name) : name}
                    </option>
                  ))}
                </select>
                {citiesLoading && <p className="mt-2 text-xs text-slate-400">{t('Loading cities…', 'جارٍ تحميل المدن…')}</p>}
              </div>
            </div>

            <div className="rounded-2xl bg-slate-800/40 border border-slate-700/50 p-4 sm:p-5">
              <label className="flex items-center justify-between text-sm font-semibold text-slate-300 mb-2">
                <span>{t('Your mobile / WhatsApp (owner)', 'جوالك / واتساب (المالك)')}</span>
                {form.ownerPhone && (
                  <a href={`/verify-phone?returnTo=/t/${slug}/manage/business`} className="text-xs font-medium text-amber-500 hover:text-amber-400">
                    {t('Change & Verify', 'تغيير وتأكيد')}
                  </a>
                )}
              </label>
              <Input
                type="tel"
                value={form.ownerPhone}
                onChange={(e) => setForm((f) => ({ ...f, ownerPhone: e.target.value }))}
                placeholder="+972 50 123 4567"
                className={`w-full sm:max-w-md h-14 rounded-xl bg-slate-900 border-slate-600 text-white px-4 text-base ${form.ownerPhone ? 'opacity-70 cursor-not-allowed' : ''}`}
                readOnly={!!form.ownerPhone}
              />
              <p className="mt-2 text-xs text-slate-400">
                {form.ownerPhone
                  ? t('Verified phone number.', 'رقم الهاتف مؤكد.')
                  : t('Must verify via SMS to place orders from the system.', 'يجب التحقق عبر SMS لوضع الطلبات من النظام.')}
              </p>
            </div>
          </div>
        </div>

        <div className="dashboard-section pt-6 border-t border-slate-800">
          <h2 className="mb-2 font-bold text-white text-lg md:text-xl tracking-tight">{t('Store details (menu page)', 'تفاصيل المتجر (صفحة القائمة)')}</h2>
          <p className="mb-5 text-sm text-slate-400">{t('Names and taglines shown on your public menu. Address and map for "Visit us" section.', 'الأسماء والشعارات المعروضة على القائمة العامة. العنوان والخريطة لقسم "زيارتنا".')}</p>
          <div className="space-y-6">
            <div className="rounded-2xl bg-slate-800/40 border border-slate-700/50 p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">{t('Name (English)', 'الاسم (إنجليزي)')}</label>
                <Input
                  value={form.name_en}
                  onChange={(e) => setForm((f) => ({ ...f, name_en: e.target.value }))}
                  className="w-full h-14 rounded-xl bg-slate-900 border-slate-600 text-white px-4 text-base"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">{t('Name (Arabic)', 'الاسم (عربي)')}</label>
                <Input
                  value={form.name_ar}
                  onChange={(e) => setForm((f) => ({ ...f, name_ar: e.target.value }))}
                  className="w-full h-14 rounded-xl bg-slate-900 border-slate-600 text-white px-4 text-base"
                />
              </div>
            </div>
            
            <div className="rounded-2xl bg-slate-800/40 border border-slate-700/50 p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">{t('Tagline (EN)', 'شعار (EN)')}</label>
                <Input
                  value={form.tagline_en}
                  onChange={(e) => setForm((f) => ({ ...f, tagline_en: e.target.value }))}
                  className="w-full h-14 rounded-xl bg-slate-900 border-slate-600 text-white px-4 text-base"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">Tagline (AR)</label>
                <Input
                  value={form.tagline_ar}
                  onChange={(e) => setForm((f) => ({ ...f, tagline_ar: e.target.value }))}
                  className="w-full h-14 rounded-xl bg-slate-900 border-slate-600 text-white px-4 text-base"
                />
              </div>
            </div>
            
            <div className="rounded-2xl bg-slate-800/40 border border-slate-700/50 p-4 sm:p-5 grid grid-cols-1 gap-5">
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">Address (EN)</label>
                <Input
                  value={form.address_en}
                  onChange={(e) => setForm((f) => ({ ...f, address_en: e.target.value }))}
                  className="w-full h-14 rounded-xl bg-slate-900 border-slate-600 text-white px-4 text-base"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">Address (AR)</label>
                <Input
                  value={form.address_ar}
                  onChange={(e) => setForm((f) => ({ ...f, address_ar: e.target.value }))}
                  className="w-full h-14 rounded-xl bg-slate-900 border-slate-600 text-white px-4 text-base"
                />
              </div>
            </div>
            
            {/* Location & Navigation Section */}
            <div className="rounded-3xl border border-sky-500/30 bg-sky-950/20 p-5 sm:p-6 space-y-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-500/20 text-sky-400">
                  <MapPin className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-white text-lg">{t('Location & Navigation', 'الموقع والتنقل')}</h3>
              </div>

              {/* GPS location share */}
              <BusinessLocationShare 
                slug={slug} 
                onSuccess={(lat, lng) => setForm(f => ({ ...f, locationLat: lat, locationLng: lng }))}
                onCityDetected={(countryCode, city) => setForm(f => ({ ...f, country: f.country || countryCode, city: f.city || city }))}
              />

              <div className="relative flex items-center py-2">
                <div className="flex-grow border-t border-slate-700/60"></div>
                <span className="flex-shrink-0 mx-4 text-slate-500 text-xs font-bold tracking-wider uppercase">{t('OR MANUAL LOCATION', 'أو تحديد يدوي للموقع')}</span>
                <div className="flex-grow border-t border-slate-700/60"></div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">
                  {t('Pinpoint on Map', 'تحديد الموقع على الخريطة')} *
                </label>
                <div className="w-full h-[300px] rounded-2xl overflow-hidden border border-slate-600 bg-slate-900">
                  <LocationPickerMap
                    lat={form.locationLat ?? cityMapCenter?.lat ?? 24.7136}
                    lng={form.locationLng ?? cityMapCenter?.lng ?? 46.6753}
                    onChange={(lat, lng) => setForm((f) => ({ ...f, locationLat: lat, locationLng: lng }))}
                  />
                </div>
                <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                  {t('Required. Drag the pin to your exact business location. Used for driver navigation and "Visit us" button.', 'مطلوب. اسحب الدبوس إلى موقع عملك الدقيق. يُستخدم لتنقل السائقين وزر "زيارتنا".')}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="dashboard-section pt-6 border-t border-slate-800">
          <h2 className="mb-2 font-bold text-white text-lg md:text-xl tracking-tight">Social links</h2>
          <p className="mb-5 text-sm text-slate-400">
            {t('Full URL or username only (e.g. burhanstudio or https://instagram.com/burhanstudio). Links open your profile on the menu.', 'رابط كامل أو اسم المستخدم فقط (مثال: burhanstudio أو https://instagram.com/burhanstudio). الروابط تفتح صفحتك على القائمة.')}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-2xl bg-slate-800/40 border border-slate-700/50 p-4 sm:p-5">
            {(['facebook', 'instagram', 'tiktok', 'snapchat', 'website'] as const).map((key) => (
              <div key={key}>
                <label className="block text-sm font-semibold text-slate-300 mb-2 capitalize">{key}</label>
                <Input
                  type="text"
                  value={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  placeholder={key === 'website' ? 'example.com or https://...' : t('URL or username', 'رابط أو اسم مستخدم')}
                  className="w-full h-14 rounded-xl bg-slate-900 border-slate-600 text-white px-4 text-base"
                />
              </div>
            ))}
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">WhatsApp number</label>
              <Input
                value={form.whatsapp}
                onChange={(e) => setForm((f) => ({ ...f, whatsapp: toEnglishDigits(e.target.value) }))}
                placeholder="972501234567"
                className="w-full h-14 rounded-xl bg-slate-900 border-slate-600 text-white px-4 text-base"
              />
            </div>
          </div>
        </div>

        <div className="dashboard-section pt-6 border-t border-slate-800">
          <h2 className="mb-2 font-bold text-white text-lg md:text-xl tracking-tight flex items-center gap-2">
            <Volume2 className="size-5 text-indigo-400" />
            {t('Notifications', 'الإشعارات')}
          </h2>
          <p className="mb-5 text-sm text-slate-400">
            {t(
              'Plays when a new order arrives on your Orders page. Click Play to preview.',
              'يُشغّل عند وصول طلب جديد في صفحة الطلبات. اضغط تشغيل للمعاينة.'
            )}
          </p>
          <div className="space-y-3 rounded-2xl bg-slate-800/40 border border-slate-700/50 p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-white mb-2">{t('WhatsApp Notifications', 'إشعارات واتساب')}</h3>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-700/80 bg-slate-900 px-4 py-3.5 transition-colors hover:bg-slate-800">
              <input
                type="checkbox"
                checked={form.prioritizeWhatsapp}
                onChange={(e) => setForm((f) => ({ ...f, prioritizeWhatsapp: e.target.checked }))}
                className="size-5 rounded border-slate-600 bg-slate-800 accent-amber-500"
              />
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-white">
                  {t('Send WhatsApp instantly', 'إرسال واتساب فوراً')}
                </span>
                <span className="text-xs text-slate-400 mt-0.5">
                  {t('Remove the 3-minute delay. Send WhatsApp immediately alongside FCM.', 'إزالة تأخير الـ 3 دقائق. إرسال إشعار واتساب فوراً مع الإشعارات.')}
                </span>
              </div>
            </label>
          </div>

          <div className="space-y-3 rounded-2xl bg-slate-800/40 border border-slate-700/50 p-4 sm:p-5 mt-4">
            <h3 className="text-sm font-semibold text-white mb-2">{t('Notification Sound', 'صوت الإشعار')}</h3>
            {NOTIFICATION_SOUNDS.map((opt) => (
              <div
                key={opt.value}
                className={`flex flex-wrap items-center gap-4 rounded-xl border p-4 transition-colors ${
                  form.notificationSound === opt.value
                    ? 'border-indigo-500/50 bg-indigo-500/10'
                    : 'border-slate-700 bg-slate-900 hover:border-slate-600 hover:bg-slate-800/80'
                }`}
              >
                <label className="flex flex-1 cursor-pointer items-center gap-3">
                  <input
                    type="radio"
                    name="notificationSound"
                    value={opt.value}
                    checked={form.notificationSound === opt.value}
                    onChange={() => setForm((f) => ({ ...f, notificationSound: opt.value }))}
                    className="size-5 accent-indigo-500"
                  />
                  <span className="text-base font-semibold text-white">{t(opt.label, opt.labelAr)}</span>
                </label>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 rounded-xl px-4 font-semibold border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white"
                  onClick={() => playNotificationSound(opt.value)}
                >
                  <Play className="mr-2 size-4" />
                  {t('Play', 'تشغيل')}
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="dashboard-section pt-6 border-t border-slate-800">
          <h2 className="mb-2 font-bold text-white text-lg md:text-xl tracking-tight flex items-center gap-2">
            <Activity className="size-5 text-cyan-400" />
            {t('Realtime diagnostics (admin)', 'تشخيص التحديث الفوري (للإدارة)')}
          </h2>
          <p className="mb-5 text-sm text-slate-400">
            {t(
              'Use this when order status actions fail. It verifies Pusher runtime and push stack configuration without exposing secrets.',
              'استخدم هذا عند فشل تغيير حالة الطلب. يفحص Pusher والإشعارات بدون عرض أي أسرار.'
            )}
          </p>
          <div className="rounded-2xl bg-slate-800/40 border border-slate-700/50 p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <Button
                type="button"
                variant="outline"
                className="h-12 rounded-xl px-5 font-semibold border-cyan-500/40 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20 hover:text-cyan-100"
                onClick={runRealtimeHealthCheck}
                disabled={realtimeHealthLoading}
              >
                <Activity className={`mr-2 size-4 ${realtimeHealthLoading ? 'animate-pulse' : ''}`} />
                {realtimeHealthLoading
                  ? t('Running check…', 'جارٍ الفحص…')
                  : t('Run realtime health check', 'تشغيل فحص التحديث الفوري')}
              </Button>

              {realtimeHealth && (
                <div className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${
                  realtimeHealth.ok
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                    : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                }`}>
                  {realtimeHealth.ok ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
                  {realtimeHealth.ok ? t('Healthy', 'سليم') : t('Issues detected', 'تم اكتشاف مشاكل')}
                </div>
              )}
            </div>

            {realtimeHealth && (
              <div className="mt-4 space-y-2 text-xs text-slate-300">
                <p>
                  <span className="text-slate-400">{t('Pusher configured:', 'إعداد Pusher:')} </span>
                  {realtimeHealth.pusher?.configured ? t('Yes', 'نعم') : t('No', 'لا')}
                </p>
                <p>
                  <span className="text-slate-400">{t('Pusher trigger test:', 'اختبار الإرسال عبر Pusher:')} </span>
                  {realtimeHealth.pusher?.triggerOk ? t('Passed', 'ناجح') : t('Failed', 'فشل')}
                </p>
                <p>
                  <span className="text-slate-400">{t('FCM configured:', 'إعداد FCM:')} </span>
                  {realtimeHealth.notifications?.fcmConfigured ? t('Yes', 'نعم') : t('No', 'لا')}
                </p>
                <p>
                  <span className="text-slate-400">{t('Web Push configured:', 'إعداد Web Push:')} </span>
                  {realtimeHealth.notifications?.webPushConfigured ? t('Yes', 'نعم') : t('No', 'لا')}
                </p>
                {!!realtimeHealth.pusher?.missingEnvKeys?.length && (
                  <p className="text-amber-300">
                    <span className="text-slate-400">{t('Missing env keys:', 'مفاتيح البيئة المفقودة:')} </span>
                    {realtimeHealth.pusher.missingEnvKeys.join(', ')}
                  </p>
                )}
                {realtimeHealth.pusher?.lastInitErrorMessage && (
                  <p className="text-rose-300">
                    <span className="text-slate-400">{t('Init error:', 'خطأ التهيئة:')} </span>
                    {realtimeHealth.pusher.lastInitErrorMessage}
                  </p>
                )}
                {realtimeHealth.error && (
                  <p className="text-rose-300">
                    <span className="text-slate-400">{t('Error:', 'خطأ:')} </span>
                    {realtimeHealth.error}
                  </p>
                )}
                {realtimeHealth.checkedAt && (
                  <p className="text-slate-500">
                    {t('Checked at', 'وقت الفحص')}: {new Date(realtimeHealth.checkedAt).toLocaleString()}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <Button type="submit" size="lg" className="w-full h-14 rounded-2xl bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 active:bg-amber-600 shadow-md shadow-amber-500/20" disabled={saving}>
          {saving ? t('Saving…', 'جاري الحفظ…') : t('Save changes', 'حفظ التغييرات')}
        </Button>
      </motion.form>

      {/* Delete business permanently - at the very bottom */}
      <motion.div variants={itemVariants} className="mt-8 max-w-3xl rounded-3xl border border-red-900/50 bg-red-950/20 p-6 md:p-8">
        <h2 className="mb-3 flex items-center gap-3 font-bold text-red-300 text-lg md:text-xl">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/20 text-red-400">
            <AlertTriangle className="size-5" />
          </div>
          {t('Delete business permanently', 'حذف العمل نهائياً')}
        </h2>
        <p className="mb-6 text-sm text-slate-400 leading-relaxed max-w-2xl">
          {t('This will permanently delete your business and all its data (menu, areas, orders, etc.) from the system. This action cannot be undone.', 'سيتم حذف عملك وجميع بياناته (القائمة، المناطق، الطلبات، إلخ) نهائياً من النظام. لا يمكن التراجع عن هذا الإجراء.')}
        </p>
        <Button
          type="button"
          variant="outline"
          className="h-14 rounded-xl px-6 font-semibold border-red-800/60 text-red-300 hover:bg-red-900/30 hover:text-red-200"
          onClick={() => setDeleteConfirmOpen(true)}
        >
          <Trash2 className="mr-2 size-5" />
          {t('Delete business permanently', 'حذف العمل نهائياً')}
        </Button>
      </motion.div>

      {/* Delete confirmation modal */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="w-full max-w-md rounded-3xl border border-red-900/50 bg-slate-900 p-6 md:p-8 shadow-2xl"
          >
            <h3 className="mb-3 text-xl font-bold text-red-300">{t('Confirm permanent delete', 'تأكيد الحذف النهائي')}</h3>
            <p className="mb-5 text-sm text-slate-400 leading-relaxed">
              {t('To confirm, type your business name exactly as shown:', 'للتأكيد، اكتب اسم عملك كما يظهر بالضبط:')}
            </p>
            <p className="mb-3 font-mono text-base font-bold text-amber-400 bg-slate-950 p-3 rounded-xl border border-slate-800 inline-block">&quot;{form.name}&quot;</p>
            <Input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder={form.name}
              className="mb-6 h-14 rounded-xl bg-slate-950 border-slate-700 text-white placeholder:text-slate-500 focus:border-red-500 focus:ring-red-500/50"
              autoFocus
            />
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                type="button"
                variant="outline"
                className="h-14 flex-1 rounded-xl font-bold border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white"
                onClick={() => { setDeleteConfirmOpen(false); setDeleteConfirmText('') }}
                disabled={deleting}
              >
                {t('Cancel', 'إلغاء')}
              </Button>
              <Button
                type="button"
                className="h-14 flex-1 rounded-xl font-bold bg-red-600 text-white hover:bg-red-500 shadow-lg shadow-red-600/20 disabled:opacity-50"
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
          </motion.div>
        </div>
      )}
    </motion.div>

    {/* Floating Save — appears when there are unsaved changes */}
    <AnimatePresence>
      {isDirty && (
        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 100 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="fixed bottom-0 left-0 right-0 z-40 p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] md:p-6 md:pb-6 pointer-events-none"
        >
          <div className="mx-auto max-w-lg shadow-2xl shadow-amber-500/20 rounded-3xl bg-slate-900 border border-amber-500/30 p-4 pointer-events-auto flex flex-col sm:flex-row items-center gap-4">
            <div className="flex-1 w-full text-center sm:text-left rtl:sm:text-right">
              <p className="text-sm font-bold text-white">
                {t('Unsaved changes', 'تغييرات غير محفوظة')}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {t('You have pending modifications.', 'لديك تعديلات بانتظار الحفظ.')}
              </p>
            </div>
            <Button
              type="button"
              onClick={() => doSave()}
              disabled={saving}
              className="w-full sm:w-auto h-14 px-8 rounded-2xl font-black text-base bg-amber-500 text-slate-950 hover:bg-amber-400 active:bg-amber-600 disabled:opacity-70 flex items-center justify-center gap-2 shadow-lg"
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
