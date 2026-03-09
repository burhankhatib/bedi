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
        <div className="bg-white border-b border-slate-200">
          <div className="container mx-auto px-4">
            <CategoryIconsBar
              activeSection={section}
              category={category || 'restaurant'}
            />
          </div>
        </div>
      )}

      <main className="container mx-auto px-4 py-8">
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

            {/* Search box + Filter toggle (same row) */}
            <div className="mb-4 flex gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  type="search"
                  placeholder={t('Search businesses or items...', 'ابحث عن أعمال أو أصناف...')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-11 rounded-xl border-slate-200 bg-white pl-10 pr-4"
                />
              </div>
              <button
                type="button"
                onClick={() => setFiltersExpanded(!filtersExpanded)}
                className={`flex size-11 shrink-0 items-center justify-center rounded-xl border transition md:size-11 ${
                  filtersExpanded
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-600'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
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

            {/* Specialty strip: Material You circular icon chips */}
            {category && sectionsWithImages.length > 0 && (
              <div className="mb-6">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {t('Specialty', 'التخصص')}
                </p>
                <div className="-mx-4 overflow-x-auto overflow-y-hidden px-4 md:-mx-0 md:px-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  <div className="flex gap-5 pb-2 md:gap-6">
                    {/* All */}
                    <button
                      onClick={() => setFilter(undefined, '', undefined)}
                      className={`flex shrink-0 flex-col items-center gap-2.5 transition-all duration-200 ${
                        !section
                          ? 'opacity-100'
                          : 'opacity-70 hover:opacity-100'
                      }`}
                    >
                      <div
                        className={`flex size-14 shrink-0 items-center justify-center rounded-full shadow-sm transition-all duration-200 md:size-16 ${
                          !section
                            ? 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-200/80'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:ring-2 hover:ring-slate-200'
                        }`}
                      >
                        <MdRestaurant className="size-7 md:size-8" />
                      </div>
                      <span className="max-w-[4.5rem] truncate text-center text-xs font-medium text-slate-700 md:max-w-20">
                        {t('All', 'الكل')}
                      </span>
                    </button>
                    {sectionsWithImages.map((s) => {
                      const Icon = getSectionIcon(s.key)
                      const isSelected = section === s.key
                      return (
                        <button
                          key={s.key}
                          onClick={() => setFilter(undefined, s.key, undefined)}
                          className={`flex shrink-0 flex-col items-center gap-2.5 transition-all duration-200 ${
                            isSelected ? 'opacity-100' : 'opacity-70 hover:opacity-100'
                          }`}
                        >
                          <div
                            className={`flex size-14 shrink-0 items-center justify-center rounded-full shadow-sm transition-all duration-200 md:size-16 ${
                              isSelected
                                ? 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-200/80'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:ring-2 hover:ring-slate-200'
                            }`}
                          >
                            <Icon className="size-7 md:size-8" />
                          </div>
                          <span className="max-w-[4.5rem] truncate text-center text-xs font-medium text-slate-700 md:max-w-20">
                            {lang === 'ar' ? s.title_ar : s.title_en}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {loading ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[...Array(6)].map((_, i) => (
                  <div
                    key={i}
                    className="h-32 animate-pulse rounded-2xl bg-slate-200"
                  />
                ))}
              </div>
            ) : filteredTenants.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
                <Store className="mx-auto size-12 text-slate-300" />
                <p className="mt-4 text-slate-600">
                  {t('No businesses found in this area.', 'لا توجد أعمال في هذه المنطقة.')}
                </p>
                <Link href="/" className="mt-4 inline-block">
                  <Button variant="outline">{t('Back to home', 'العودة للرئيسية')}</Button>
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {filteredTenants.map((t, i) => (
                  <motion.div
                    key={t._id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: Math.min(i * 0.03, 0.3) }}
                  >
                    <Link
                      href={t.slug ? `/t/${t.slug}` : '#'}
                      className="group flex items-center gap-4 overflow-hidden rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-all duration-200 hover:border-emerald-300 hover:shadow-md"
                    >
                      {/* Logo - bigger, left */}
                      <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-slate-50 ring-1 ring-slate-100">
                        {t.logoUrl ? (
                          <Image
                            src={t.logoUrl}
                            alt={(lang === 'ar' ? t.name_ar : t.name_en) || t.name}
                            fill
                            className="object-contain p-1.5"
                            sizes="80px"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <Store className="size-10 text-slate-300" />
                          </div>
                        )}
                      </div>
                      {/* Details - right */}
                      <div className="min-w-0 flex-1">
                        <h2 className="font-bold text-slate-900 truncate group-hover:text-emerald-700 transition-colors">
                          {(lang === 'ar' ? t.name_ar : t.name_en) || t.name}
                        </h2>
                        <p className="text-sm text-slate-500 capitalize">
                          {lang === 'ar'
                            ? BUSINESS_TYPES.find((b) => b.value === t.businessType)?.labelAr ??
                              t.businessType
                            : BUSINESS_TYPES.find((b) => b.value === t.businessType)?.label ??
                              t.businessType}
                        </p>
                        {t.sections.length > 0 && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-600">
                            <UtensilsCrossed className="size-3.5 shrink-0 text-emerald-600" />
                            <span className="line-clamp-1">
                              {t.sections
                                .map((s) => (lang === 'ar' ? s.ar || s.en : s.en || s.ar))
                                .filter(Boolean)
                                .join(' • ')}
                            </span>
                          </div>
                        )}
                        {t.popularItems.length > 0 && (
                          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-amber-700">
                            <Flame className="size-3 shrink-0 text-amber-500" />
                            <span className="line-clamp-1 font-medium">
                              {t.popularItems
                                .map((p) => (lang === 'ar' ? p.ar || p.en : p.en || p.ar))
                                .filter(Boolean)
                                .join(', ')}
                            </span>
                          </div>
                        )}
                      </div>
                      <ChevronRight className="size-4 shrink-0 text-slate-300 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all" />
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
