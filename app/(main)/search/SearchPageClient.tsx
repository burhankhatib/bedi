'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useSearchParams, useRouter } from 'next/navigation'
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
          {/* Stores = markets, pharmacies, retail, bakery, other (excludes restaurant/cafe) */}
          {(meta?.categoryCounts?.stores ?? 0) > 0 && (
            <button
              onClick={() => setFilter('stores', undefined, undefined)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                category === 'stores' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t('Stores', 'متاجر')}
            </button>
          )}
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
                !section ? 'bg-brand-yellow text-brand-black shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t('All', 'الكل')}
            </button>
            {meta.availableSections.map((s) => (
              <button
                key={s.key}
                onClick={() => setFilter(undefined, s.key, undefined)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  section === s.key ? 'bg-brand-yellow text-brand-black shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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
                !area ? 'bg-brand-yellow text-brand-black shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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
                    ? 'bg-brand-yellow text-brand-black shadow-sm'
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
  const urlQuery = searchParams.get('q') ?? ''
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [meta, setMeta] = useState<Meta | null>(null)
  const [businessCategories, setBusinessCategories] = useState<BusinessCategory[]>([])
  const [sectionsWithImages, setSectionsWithImages] = useState<SectionWithImage[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState(urlQuery)
  const [filtersExpanded, setFiltersExpanded] = useState(false)
  const [searchResults, setSearchResults] = useState<{
    businesses: Array<{ _id: string; name: string; name_en: string | null; name_ar: string | null; slug: string; businessType: string; logoUrl: string | null }>
    products: Array<{
      _id: string
      title_en: string | null
      title_ar: string | null
      imageUrl: string | null
      price: number
      currency: string
      business: { name: string; slug: string; logoUrl: string | null }
    }>
  } | null>(null)
  const [allCategoryImageError, setAllCategoryImageError] = useState(false)
  const allCategoryImageUrl =
    category && !allCategoryImageError
      ? (businessCategories.find((c) => c.value === category)?.imageUrl ?? null)
      : null

  useEffect(() => {
    setAllCategoryImageError(false)
  }, [category])

  useEffect(() => {
    const isDesktop = typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches
    setFiltersExpanded(isDesktop ? expandFilters : false)
  }, [expandFilters])

  const hasSearchQuery = searchQuery.trim().length > 0
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const latestSearchRequestRef = useRef(0)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 300)
    return () => clearTimeout(t)
  }, [searchQuery])

  useEffect(() => {
    const q = debouncedQuery
    const current = searchParams.get('q') ?? ''
    if (q === current) return
    const p = new URLSearchParams(searchParams.toString())
    if (q) p.set('q', q)
    else p.delete('q')
    router.replace(`/search?${p.toString()}`, { scroll: false })
  }, [debouncedQuery, router, searchParams])

  useEffect(() => {
    if (!isChosen || !city) {
      latestSearchRequestRef.current += 1
      setTenants([])
      setMeta(null)
      setSectionsWithImages([])
      setSearchResults(null)
      setLoading(false)
      return
    }
    if (debouncedQuery) {
      let mounted = true
      const requestId = ++latestSearchRequestRef.current
      setSearchResults(null)
      setLoading(true)
      const params = new URLSearchParams({ city, q: debouncedQuery, lang: lang === 'ar' ? 'ar' : 'en' })
      const ac = new AbortController()
      fetch(`/api/home/search?${params}`, { signal: ac.signal })
        .then((res) => res.json())
        .then((data) => {
          if (mounted && latestSearchRequestRef.current === requestId) {
            setSearchResults({ businesses: data?.businesses ?? [], products: data?.products ?? [] })
          }
        })
        .catch((err) => {
          if (mounted && latestSearchRequestRef.current === requestId && err?.name !== 'AbortError') {
            setSearchResults({ businesses: [], products: [] })
          }
        })
        .finally(() => {
          if (mounted && latestSearchRequestRef.current === requestId) setLoading(false)
        })
      return () => { mounted = false; ac.abort() }
    }
    latestSearchRequestRef.current += 1
    setSearchResults(null)
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

    let mounted = true
    const ac = new AbortController()
    fetch(`/api/home/tenants?${params}`, { signal: ac.signal })
      .then((res) => res.json())
      .then((data) => {
        if (mounted) {
          tenantsCache.set(cacheKey, { data, expires: now + CACHE_TTL_MS })
          setTenants(Array.isArray(data?.tenants) ? data.tenants : [])
          setMeta(data?.meta ?? null)
        }
      })
      .catch((err) => { if (mounted && err?.name !== 'AbortError') { setTenants([]); setMeta(null) } })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false; ac.abort() }
  }, [isChosen, city, category, section, area, debouncedQuery, lang])

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

    let mounted = true
    const ac = new AbortController()
    fetch(`/api/home/categories?${params}`, { signal: ac.signal })
      .then((res) => res.json())
      .then((data) => {
        if (mounted) {
          categoriesCache.set(cacheKey, { data, expires: now + CACHE_TTL_MS })
          setBusinessCategories(Array.isArray(data) ? data : [])
        }
      })
      .catch((err) => { if (mounted && err?.name !== 'AbortError') setBusinessCategories([]) })
    return () => { mounted = false; ac.abort() }
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

    let mounted = true
    const ac = new AbortController()
    fetch(`/api/home/sections?${params}`, { signal: ac.signal })
      .then((res) => res.json())
      .then((data) => {
        if (mounted) {
          sectionsCache.set(cacheKey, { data, expires: now + CACHE_TTL_MS })
          setSectionsWithImages(Array.isArray(data) ? data : [])
        }
      })
      .catch((err) => { if (mounted && err?.name !== 'AbortError') setSectionsWithImages([]) })
    return () => { mounted = false; ac.abort() }
  }, [isChosen, city, category])

  const showSearchResults = debouncedQuery && (searchResults || loading)
  const displayTenants = showSearchResults ? [] : tenants

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
        <div className="bg-white border-b border-slate-100 shadow-sm sticky z-20" style={{ top: 'calc(72px + env(safe-area-inset-top))' }}>
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
                <Search className="absolute start-4 top-1/2 size-5 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
                <Input
                  type="search"
                  placeholder={t('Search businesses or items...', 'ابحث عن أعمال أو أصناف...')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-14 rounded-full border-0 bg-slate-100/80 px-12 text-base shadow-inner focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-brand-red/50 transition-all font-medium placeholder:text-slate-400 placeholder:font-normal"
                />
              </div>
              <button
                type="button"
                onClick={() => setFiltersExpanded(!filtersExpanded)}
                className={`flex size-14 shrink-0 items-center justify-center rounded-full transition-all duration-300 md:size-14 ${
                  filtersExpanded
                    ? 'bg-brand-yellow text-brand-black shadow-sm'
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
                {filtersExpanded && (
                  <div className="mb-6 md:hidden">
                    <FilterPanelContent
                      meta={meta}
                      category={category}
                      section={section}
                      area={area}
                      setFilter={setFilter}
                      lang={lang}
                      t={t}
                    />
                  </div>
                )}

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
            ) : showSearchResults && searchResults ? (
              <>
                {/* Search results: Businesses first, then Products */}
                {(searchResults.businesses.length > 0 || searchResults.products.length > 0) ? (
                  <div className="space-y-8 pt-4">
                    {searchResults.businesses.length > 0 && (
                      <section>
                        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
                          {t('Businesses', 'الأعمال')}
                        </h2>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                          {searchResults.businesses.map((b) => (
                            <div key={b._id}>
                              <Link
                                href={b.slug ? `/t/${b.slug}` : '#'}
                                className="group flex flex-col items-center gap-3 rounded-2xl bg-white p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] transition-all duration-300 hover:shadow-lg border border-transparent hover:border-slate-200"
                              >
                                <div className="relative size-20 sm:size-24 shrink-0 overflow-hidden rounded-2xl bg-slate-100">
                                  {b.logoUrl ? (
                                    <Image src={b.logoUrl} alt={b.name} fill className="object-contain p-2" sizes="96px" />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center">
                                      <Store className="size-10 text-slate-300" />
                                    </div>
                                  )}
                                </div>
                                <h3 className="font-bold text-slate-900 text-lg text-center line-clamp-1">
                                  {(lang === 'ar' ? b.name_ar : b.name_en) || b.name}
                                </h3>
                              </Link>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}
                    {searchResults.products.length > 0 && (
                      <section>
                        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
                          {t('Products & meals', 'المنتجات والوجبات')}
                        </h2>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                          {searchResults.products.map((p) => (
                            <div key={p._id}>
                              <Link
                                href={p.business.slug ? `/t/${p.business.slug}` : '#'}
                                className="group block overflow-hidden rounded-2xl bg-white shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] transition-all duration-300 hover:shadow-lg border border-transparent hover:border-slate-200"
                              >
                                <div className="relative aspect-square sm:aspect-[4/3] bg-slate-100">
                                  {p.imageUrl ? (
                                    <Image src={p.imageUrl} alt={(lang === 'ar' ? p.title_ar : p.title_en) || ''} fill className="object-cover" sizes="(max-width: 640px) 100vw, 280px" />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center">
                                      <UtensilsCrossed className="size-12 text-slate-300" />
                                    </div>
                                  )}
                                </div>
                                <div className="p-4">
                                  <h3 className="font-bold text-slate-900 text-lg line-clamp-2">
                                    {(lang === 'ar' ? p.title_ar : p.title_en) || ''}
                                  </h3>
                                  <p className="mt-1 text-sm text-slate-500 font-medium">
                                    {p.business.name}
                                  </p>
                                  {p.price > 0 && (
                                    <p className="mt-2 font-bold text-slate-900">
                                      {p.price} {p.currency}
                                    </p>
                                  )}
                                </div>
                              </Link>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}
                  </div>
                ) : (
                  <div className="rounded-3xl border border-slate-100 bg-white p-12 text-center shadow-sm">
                    <Search className="mx-auto size-16 text-slate-200" />
                    <p className="mt-4 text-slate-600 font-medium text-lg">
                      {t('No results found for your search.', 'لم يتم العثور على نتائج لبحثك.')}
                    </p>
                    <Button variant="outline" className="mt-6 rounded-full shadow-sm px-6 h-12" onClick={() => setSearchQuery('')}>
                      {t('Clear search', 'مسح البحث')}
                    </Button>
                  </div>
                )}
              </>
            ) : displayTenants.length === 0 ? (
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
                {displayTenants.map((t) => (
                  <div key={t._id}>
                    <Link
                      href={t.slug ? `/t/${t.slug}` : '#'}
                      className="group flex items-center gap-4 overflow-hidden rounded-[20px] bg-white p-4 transition-all duration-300 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.12)] border border-transparent hover:border-brand-yellow/30"
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
                        <h2 className="font-bold text-slate-900 text-[17px] tracking-tight truncate group-hover:text-brand-yellow transition-colors">
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
                  </div>
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
