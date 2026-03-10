'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useSearchParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'motion/react'
import { useLocation } from '@/components/LocationContext'
import { useLanguage } from '@/components/LanguageContext'
import { SiteHeader } from '@/components/global/SiteHeader'
import { LocationModal } from '@/components/global/LocationModal'
import { Button } from '@/components/ui/button'
import { Store, UtensilsCrossed, Flame, ChevronRight, Search, MapPin, Filter } from 'lucide-react'
import { MdRestaurant } from 'react-icons/md'
import { BUSINESS_TYPES } from '@/lib/constants'
import { getSectionIcon } from '@/lib/section-icons'
import { getCityDisplayName } from '@/lib/registration-translations'
import { Input } from '@/components/ui/input'
import { CategoryIconsBar } from '@/components/home/CategoryIconsBar'

type SectionWithImage = {
  key: string
  title_en: string
  title_ar: string
  tenantCount: number
  imageUrl: string | null
}

type Localized = { en: string; ar: string }

type Tenant = {
  _id: string
  name: string
  name_en?: string | null
  name_ar?: string | null
  slug: string
  businessType: string
  logoUrl: string | null
  sections: Localized[]
  popularItems: Localized[]
}

type Meta = {
  availableSections: Array<{ key: string; en: string; ar: string }>
  availableAreas: Array<{ name_en: string; name_ar: string; key: string }>
  categoryCounts: Record<string, number>
}

function normalizeSearch(s: string): string {
  return (s ?? '').toLowerCase().trim().replace(/\s+/g, ' ')
}

type FilterPanelContentProps = {
  meta: Meta | null
  category: string
  section: string
  area: string
  setFilter: (cat?: string, sec?: string, ar?: string) => void
  lang: string
  t: (en: string, ar: string) => string
}

function FilterPanelContent({ meta, category, section, area, setFilter, lang, t }: FilterPanelContentProps) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-4">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          {t('Category', 'التصنيف')}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilter('', undefined, undefined)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              !category ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {t('All', 'الكل')}
          </button>
          {BUSINESS_TYPES.filter(
            (b) => !meta?.categoryCounts || (meta.categoryCounts[b.value] ?? 0) > 0
          ).map((b) => (
            <button
              key={b.value}
              onClick={() => setFilter(b.value, undefined, undefined)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                category === b.value ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {lang === 'ar' ? b.labelAr : b.label}
            </button>
          ))}
        </div>
      </div>
      {meta && meta.availableSections.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {t('Specialty', 'التخصص')}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilter(undefined, '', undefined)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                !section ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t('All', 'الكل')}
            </button>
            {meta.availableSections.map((s) => (
              <button
                key={s.key}
                onClick={() => setFilter(undefined, s.key, undefined)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  section === s.key ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {lang === 'ar' ? s.ar : s.en}
              </button>
            ))}
          </div>
        </div>
      )}
      {meta && meta.availableAreas.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {t('Delivery area', 'منطقة التوصيل')}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilter(undefined, undefined, '')}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                !area ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t('Any', 'أي منطقة')}
            </button>
            {meta.availableAreas.map((a) => (
              <button
                key={a.key}
                onClick={() => setFilter(undefined, undefined, lang === 'ar' ? a.name_ar : a.name_en)}
                className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition ${
                  area && (area === a.name_en || area === a.name_ar)
                    ? 'bg-amber-500 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <MapPin className="size-3.5 shrink-0" />
                {lang === 'ar' ? a.name_ar : a.name_en}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

type BusinessCategory = {
  _id: string
  value: string
  name_en: string
  name_ar: string
  imageUrl: string | null
  tenantCount: number
}

const CACHE_TTL_MS = 120000

const tenantsCache = new Map<string, { data: any; expires: number }>()
const categoriesCache = new Map<string, { data: any; expires: number }>()
const sectionsCache = new Map<string, { data: any; expires: number }>()

export function SearchPageClient() {
  const { t, lang } = useLanguage()
  const { city, isChosen, setOpenLocationModal } = useLocation()
  const searchParams = useSearchParams()
  const router = useRouter()
  const category = searchParams.get('category') ?? ''
  const section = searchParams.get('section') ?? ''
  const area = searchParams.get('area') ?? ''
  const expandFilters = searchParams.get('expand') === '1'
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [meta, setMeta] = useState<Meta | null>(null)
  const [businessCategories, setBusinessCategories] = useState<BusinessCategory[]>([])
  const [sectionsWithImages, setSectionsWithImages] = useState<SectionWithImage[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filtersExpanded, setFiltersExpanded] = useState(false)
  const [allCategoryImageError, setAllCategoryImageError] = useState(false)
  const allCategoryImageUrl =
    category && !allCategoryImageError
      ? (businessCategories.find((c) => c.value === category)?.imageUrl ?? null)
      : null

  useEffect(() => {
    setAllCategoryImageError(false)
  }, [category])

  useEffect(() => {
    setFiltersExpanded(expandFilters || !category)
  }, [expandFilters, category])

  useEffect(() => {
    if (!isChosen || !city) {
      setTenants([])
      setMeta(null)
      setSectionsWithImages([])
      setLoading(false)
      return
    }
    setLoading(true)
    const params = new URLSearchParams({ city })
    if (category) params.set('category', category)
    if (section) params.set('section', section)
    if (area) params.set('area', area)

    const cacheKey = params.toString()
    const now = Date.now()
    const cached = tenantsCache.get(cacheKey)
    if (cached && cached.expires > now) {
      setTenants(Array.isArray(cached.data?.tenants) ? cached.data.tenants : [])
      setMeta(cached.data?.meta ?? null)
      setLoading(false)
      return
    }

    fetch(`/api/home/tenants?${params}`)
      .then((res) => res.json())
      .then((data) => {
        tenantsCache.set(cacheKey, { data, expires: now + CACHE_TTL_MS })
        setTenants(Array.isArray(data?.tenants) ? data.tenants : [])
        setMeta(data?.meta ?? null)
      })
      .finally(() => setLoading(false))
  }, [isChosen, city, category, section, area])

  useEffect(() => {
    if (!isChosen || !city) {
      setBusinessCategories([])
      return
    }
    const params = new URLSearchParams({ city })
    const cacheKey = params.toString()
    const now = Date.now()
    const cached = categoriesCache.get(cacheKey)
    if (cached && cached.expires > now) {
      setBusinessCategories(Array.isArray(cached.data) ? cached.data : [])
      return
    }

    fetch(`/api/home/categories?${params}`)
      .then((res) => res.json())
      .then((data) => {
        categoriesCache.set(cacheKey, { data, expires: now + CACHE_TTL_MS })
        setBusinessCategories(Array.isArray(data) ? data : [])
      })
      .catch(() => setBusinessCategories([]))
  }, [isChosen, city])

  useEffect(() => {
    if (!isChosen || !city || !category) {
      setSectionsWithImages([])
      return
    }
    const params = new URLSearchParams({ city, category })
    const cacheKey = params.toString()
    const now = Date.now()
    const cached = sectionsCache.get(cacheKey)
    if (cached && cached.expires > now) {
      setSectionsWithImages(Array.isArray(cached.data) ? cached.data : [])
      return
    }

    fetch(`/api/home/sections?${params}`)
      .then((res) => res.json())
      .then((data) => {
        sectionsCache.set(cacheKey, { data, expires: now + CACHE_TTL_MS })
        setSectionsWithImages(Array.isArray(data) ? data : [])
      })
      .catch(() => setSectionsWithImages([]))
  }, [isChosen, city, category])

  const filteredTenants = useMemo(() => {
    if (!searchQuery.trim()) return tenants
    const q = normalizeSearch(searchQuery)
    return tenants.filter((t) => {
      const displayNameEn = t.name_en ?? t.name
      const displayNameAr = t.name_ar ?? t.name
      if (
        normalizeSearch(t.name).includes(q) ||
        normalizeSearch(displayNameEn).includes(q) ||
        normalizeSearch(displayNameAr).includes(q)
      )
        return true
      for (const s of t.sections) {
        if (normalizeSearch(s.en).includes(q) || normalizeSearch(s.ar).includes(q)) return true
      }
      for (const p of t.popularItems) {
        if (normalizeSearch(p.en).includes(q) || normalizeSearch(p.ar).includes(q)) return true
      }
      return false
    })
  }, [tenants, searchQuery])

  const setFilter = (cat?: string, sec?: string, ar?: string) => {
    const p = new URLSearchParams(searchParams.toString())
    if (cat !== undefined) {
      if (cat) p.set('category', cat)
      else p.delete('category')
    }
    if (sec !== undefined) {
      if (sec) p.set('section', sec)
      else p.delete('section')
    }
    if (ar !== undefined) {
      if (ar) p.set('area', ar)
      else p.delete('area')
    }
    router.push(`/search?${p.toString()}`)
  }

  const categoryLabel =
    category && BUSINESS_TYPES.find((b) => b.value === category)
      ? lang === 'ar'
        ? BUSINESS_TYPES.find((b) => b.value === category)!.labelAr
        : BUSINESS_TYPES.find((b) => b.value === category)!.label
      : null

  return (
    <div className="min-h-screen bg-slate-50" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <SiteHeader variant="home" />
      <LocationModal />

      {isChosen && (category === 'restaurant' || category === 'cafe' || !category) && (
        <div className="bg-white border-b border-slate-100 shadow-sm sticky top-14 z-20">
          <div className="container mx-auto px-4">
            <CategoryIconsBar
              activeSection={section}
              category={category || 'restaurant'}
            />
          </div>
        </div>
      )}

      <main className="container mx-auto px-4 py-8 max-w-7xl">
        {!isChosen ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-lg text-slate-600">
              {t('Choose your location to see businesses.', 'اختر موقعك لرؤية الأعمال.')}
            </p>
            <Button
              className="mt-4"
              onClick={() => setOpenLocationModal(true)}
            >
              {t('Choose location', 'اختر الموقع')}
            </Button>
          </div>
        ) : (
          <>
            <h1 className="mb-6 text-2xl font-bold text-slate-900">
              {categoryLabel
                ? t('{category} in {city}', '{category} في {city}')
                    .replace('{category}', categoryLabel)
                    .replace('{city}', (getCityDisplayName(city ?? null, lang) || city) ?? '')
                : t('All businesses in {city}', 'جميع الأعمال في {city}').replace(
                    '{city}',
                    (getCityDisplayName(city ?? null, lang) || city) ?? ''
                  )}
            </h1>

            {/* M3 Search Header */}
            <div className="mb-6 flex gap-3 items-center">
              <div className="relative min-w-0 flex-1 group">
                <Search className="absolute start-4 top-1/2 size-5 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                <Input
                  type="search"
                  placeholder={t('Search businesses or items...', 'ابحث عن أعمال أو أصناف...')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-14 rounded-full border-0 bg-slate-100/80 px-12 text-base shadow-inner focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-emerald-500/50 transition-all font-medium placeholder:text-slate-400 placeholder:font-normal"
                />
              </div>
              <button
                type="button"
                onClick={() => setFiltersExpanded(!filtersExpanded)}
                className={`flex size-14 shrink-0 items-center justify-center rounded-full transition-all duration-300 md:size-14 ${
                  filtersExpanded
                    ? 'bg-emerald-100 text-emerald-700 shadow-sm'
                    : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200 shadow-sm'
                }`}
                aria-label={t('Filters', 'الفلاتر')}
                aria-expanded={filtersExpanded}
              >
                <Filter className="size-5" />
              </button>
            </div>

            {/* Filters panel (toggleable) */}
            {/* Desktop: sidebar column when expanded; mobile: collapsible panel below */}
            <div className="flex flex-col md:flex-row md:gap-6">
              {/* Desktop sidebar: only when expanded */}
              {filtersExpanded && (
                <aside
                  aria-label={t('Filters', 'الفلاتر')}
                  className="hidden w-[280px] shrink-0 md:block md:sticky md:top-24 md:self-start"
                >
                  <FilterPanelContent
                    meta={meta}
                    category={category}
                    section={section}
                    area={area}
                    setFilter={setFilter}
                    lang={lang}
                    t={t}
                  />
                </aside>
              )}
              <div className="min-w-0 flex-1">
                {/* Mobile: filters panel (collapse/expand) */}
                <AnimatePresence initial={false}>
                  {filtersExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="mb-6 overflow-hidden md:hidden"
                    >
                      <FilterPanelContent
                        meta={meta}
                        category={category}
                        section={section}
                        area={area}
                        setFilter={setFilter}
                        lang={lang}
                        t={t}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

            {/* Note: In M3 Overhaul, the duplicate Specialty strip widget was removed because the top header (CategoryIconsBar) already solves this filtering natively and sticky-persists. */}

            {loading ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {[...Array(8)].map((_, i) => (
                  <div
                    key={i}
                    className="h-[104px] animate-pulse rounded-2xl bg-slate-200/60"
                  />
                ))}
              </div>
            ) : filteredTenants.length === 0 ? (
              <div className="rounded-3xl border border-slate-100 bg-white p-12 text-center shadow-sm">
                <Store className="mx-auto size-16 text-slate-200" />
                <p className="mt-4 text-slate-600 font-medium text-lg">
                  {t('No businesses found in this area.', 'لا توجد أعمال في هذه المنطقة.')}
                </p>
                <Link href="/" className="mt-6 inline-block">
                  <Button variant="outline" className="rounded-full shadow-sm px-6 h-12">
                    {t('Back to home', 'العودة للرئيسية')}
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 pt-4">
                {filteredTenants.map((t, i) => (
                  <motion.div
                    key={t._id}
                    initial={{ opacity: 0, scale: 0.95, y: 16 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: [0.2, 0, 0, 1], delay: Math.min(i * 0.04, 0.4) }}
                  >
                    <Link
                      href={t.slug ? `/t/${t.slug}` : '#'}
                      className="group flex items-center gap-4 overflow-hidden rounded-[20px] bg-white p-4 transition-all duration-300 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.12)] border border-transparent hover:border-emerald-100"
                    >
                      {/* Logo - Circular elevated avatar M3 */}
                      <div className="relative size-[72px] shrink-0 overflow-hidden rounded-full bg-slate-50 shadow-sm border border-slate-100/60 group-hover:scale-[1.03] transition-transform duration-300">
                        {t.logoUrl ? (
                          <Image
                            src={t.logoUrl}
                            alt={(lang === 'ar' ? t.name_ar : t.name_en) || t.name}
                            fill
                            className="object-contain p-2"
                            sizes="72px"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <Store className="size-8 text-slate-300" />
                          </div>
                        )}
                      </div>
                      {/* Details - Right stack */}
                      <div className="min-w-0 flex-1 flex flex-col justify-center">
                        <h2 className="font-bold text-slate-900 text-[17px] tracking-tight truncate group-hover:text-emerald-700 transition-colors">
                          {(lang === 'ar' ? t.name_ar : t.name_en) || t.name}
                        </h2>
                        
                        <div className="flex items-center gap-1.5 mt-0.5 text-[13px] text-slate-500 capitalize font-medium">
                          {lang === 'ar'
                            ? BUSINESS_TYPES.find((b) => b.value === t.businessType)?.labelAr ??
                              t.businessType
                            : BUSINESS_TYPES.find((b) => b.value === t.businessType)?.label ??
                              t.businessType}
                        </div>

                        {t.sections.length > 0 && (
                          <div className="flex items-center gap-1.5 mt-1.5 text-[13px] text-slate-500">
                            <UtensilsCrossed className="size-3.5 shrink-0 text-slate-400" />
                            <span className="line-clamp-1">
                              {t.sections
                                .map((s) => (lang === 'ar' ? s.ar || s.en : s.en || s.ar))
                                .filter(Boolean)
                                .join(' • ')}
                            </span>
                          </div>
                        )}
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            )}
                </div>
              </div>
          </>
        )}
      </main>
    </div>
  )
}
