'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { FullPageLink } from '@/components/ui/FullPageLink'
import Image from 'next/image'
import { useSearchParams, useRouter } from 'next/navigation'
import { useLocation } from '@/components/LocationContext'
import { useLanguage } from '@/components/LanguageContext'
import { SiteHeader } from '@/components/global/SiteHeader'
import { LocationModal } from '@/components/global/LocationModal'
import { Button } from '@/components/ui/button'
import { Store, UtensilsCrossed, Flame, ChevronRight, ChevronDown, Search, MapPin, Filter, LayoutGrid, List, Sparkles } from 'lucide-react'
import { MdRestaurant } from 'react-icons/md'
import { BUSINESS_TYPES } from '@/lib/constants'
import { getCityDisplayName } from '@/lib/registration-translations'
import { UniversalSearch } from '@/components/search/UniversalSearch'
import { CategoryIconsBar } from '@/components/home/CategoryIconsBar'
import { BusinessListingCard } from '@/components/home/BusinessListingCard'
import { BUSINESS_LISTING_CARD_GRID_CLASS } from '@/lib/ui/businessListingGrid'
import { isLikelyQuestion } from '@/lib/ai/question-detection'
import { cn } from '@/lib/utils'

type Localized = { en: string; ar: string }

type Tenant = {
  _id: string
  name: string
  name_en?: string | null
  name_ar?: string | null
  slug: string
  businessType: string
  freeDeliveryEnabled?: boolean
  logoUrl: string | null
  sections: Localized[]
  popularItems: Localized[]
  rating?: { averageScore: number; totalCount: number } | null
}

type Meta = {
  availableSubcategories: Array<{ _id: string; en: string; ar: string }>
  availableAreas: Array<{ name_en: string; name_ar: string; key: string }>
  categoryCounts: Record<string, number>
}

type FilterPanelContentProps = {
  meta: Meta | null
  category: string
  subcategory: string
  area: string
  setFilter: (cat?: string, subcat?: string, ar?: string) => void
  lang: string
  t: (en: string, ar: string) => string
}

function FilterPanelContent({ meta, category, subcategory, area, setFilter, lang, t }: FilterPanelContentProps) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-4">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          {t('Category', 'التصنيف')}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilter('', '', undefined)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              !category ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {t('All', 'الكل')}
          </button>
          {/* Stores = markets, pharmacies, retail, bakery, other (excludes restaurant/cafe) */}
          {(meta?.categoryCounts?.stores ?? 0) > 0 && (
            <button
              onClick={() => setFilter('stores', '', undefined)}
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
              onClick={() => setFilter(b.value, '', undefined)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                category === b.value ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {lang === 'ar' ? b.labelAr : b.label}
            </button>
          ))}
        </div>
      </div>
      {meta && (meta.availableSubcategories?.length ?? 0) > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {t('Specialty', 'التخصص')}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilter(undefined, '', undefined)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                !subcategory ? 'bg-brand-yellow text-brand-black shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t('All', 'الكل')}
            </button>
            {meta.availableSubcategories.map((s) => (
              <button
                key={s._id}
                onClick={() => setFilter(undefined, s._id, undefined)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  subcategory === s._id ? 'bg-brand-yellow text-brand-black shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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

export function SearchPageClient() {
  const { t, lang } = useLanguage()
  const { city, isChosen, setOpenLocationModal } = useLocation()
  const searchParams = useSearchParams()
  const router = useRouter()
  const category = searchParams.get('category') ?? ''
  const subcategory = searchParams.get('subcategory') ?? ''
  const area = searchParams.get('area') ?? ''
  const expandFilters = searchParams.get('expand') === '1'
  const urlQuery = searchParams.get('q') ?? ''
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [meta, setMeta] = useState<Meta | null>(null)
  const [businessCategories, setBusinessCategories] = useState<BusinessCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState(urlQuery)
  const [debouncedQuery, setDebouncedQuery] = useState(urlQuery)
  const [filtersExpanded, setFiltersExpanded] = useState(false)
  /** Mobile search tips: collapsed by default; hidden once user types or gets results/AI. */
  const [searchInstructionsOpen, setSearchInstructionsOpen] = useState(false)
  const [searchResults, setSearchResults] = useState<{
    businesses: Array<{ _id: string; name: string; name_en: string | null; name_ar: string | null; slug: string; businessType: string; freeDeliveryEnabled?: boolean; logoUrl: string | null }>
    products: Array<{
      _id: string
      title_en: string | null
      title_ar: string | null
      imageUrl: string | null
      price: number
      currency: string
      orderCount?: number
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
  const latestSearchRequestRef = useRef(0)
  const lastUrlUpdateRef = useRef<string | null>(null)
  useEffect(() => {
    const trimmed = searchQuery.trim()
    if (!trimmed) {
      setDebouncedQuery('')
      setSearchResults(null)
      return
    }
    const t = setTimeout(() => setDebouncedQuery(trimmed), 300)
    return () => clearTimeout(t)
  }, [searchQuery])

  useEffect(() => {
    const urlQ = searchParams.get('q') ?? ''
    if (lastUrlUpdateRef.current === urlQ) return
    lastUrlUpdateRef.current = null
    setSearchQuery(urlQ)
    setDebouncedQuery(urlQ)
  }, [searchParams])

  useEffect(() => {
    const q = debouncedQuery
    const current = searchParams.get('q') ?? ''
    if (q === current) return
    lastUrlUpdateRef.current = q || ''
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
    if (subcategory) params.set('subcategory', subcategory)
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
  }, [isChosen, city, category, subcategory, area, debouncedQuery, lang])

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

  const showSearchResults = searchQuery.trim() && debouncedQuery && (searchResults || loading)
  const displayTenants = showSearchResults ? [] : tenants
  const hasSearchResults = searchResults && (searchResults.businesses.length > 0 || searchResults.products.length > 0)

  // View & sort: businesses always list/scroll; products default to list, sort by popularity
  const [productViewMode, setProductViewMode] = useState<'grid' | 'list'>('list')
  const [sortBy, setSortBy] = useState<'popularity' | 'relevance' | 'name-asc' | 'name-desc' | 'price-asc' | 'price-desc'>('popularity')

  const sortedSearchResults = useMemo(() => {
    if (!searchResults) return null
    const businesses = [...searchResults.businesses]
    const products = [...searchResults.products]
    const getName = (b: { name_en?: string | null; name_ar?: string | null; name: string }) =>
      (lang === 'ar' ? b.name_ar : b.name_en) || b.name || ''
    const getProductName = (p: { title_en?: string | null; title_ar?: string | null }) =>
      (lang === 'ar' ? p.title_ar : p.title_en) || (p.title_en ?? p.title_ar) || ''

    if (sortBy === 'popularity') {
      products.sort((a, b) => (b.orderCount ?? 0) - (a.orderCount ?? 0))
    } else if (sortBy === 'name-asc') {
      businesses.sort((a, b) => getName(a).localeCompare(getName(b), lang === 'ar' ? 'ar' : 'en'))
      products.sort((a, b) => getProductName(a).localeCompare(getProductName(b), lang === 'ar' ? 'ar' : 'en'))
    } else if (sortBy === 'name-desc') {
      businesses.sort((a, b) => getName(b).localeCompare(getName(a), lang === 'ar' ? 'ar' : 'en'))
      products.sort((a, b) => getProductName(b).localeCompare(getProductName(a), lang === 'ar' ? 'ar' : 'en'))
    } else if (sortBy === 'price-asc') {
      products.sort((a, b) => (a.price ?? 0) - (b.price ?? 0))
    } else if (sortBy === 'price-desc') {
      products.sort((a, b) => (b.price ?? 0) - (a.price ?? 0))
    }
    return { businesses, products }
  }, [searchResults, sortBy, lang])

  const setFilter = (cat?: string, subcat?: string, ar?: string) => {
    const p = new URLSearchParams(searchParams.toString())
    if (cat !== undefined) {
      if (cat) p.set('category', cat)
      else p.delete('category')
    }
    if (subcat !== undefined) {
      if (subcat) p.set('subcategory', subcat)
      else p.delete('subcategory')
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

  const isQuestionMode = searchQuery.trim().length > 0 && isLikelyQuestion(searchQuery)
  const showAIAssistantState = showSearchResults && !hasSearchResults && isQuestionMode

  const hideMobileSearchTips =
    !!searchQuery.trim() || showSearchResults || showAIAssistantState || (loading && hasSearchQuery)

  useEffect(() => {
    if (hideMobileSearchTips) setSearchInstructionsOpen(false)
  }, [hideMobileSearchTips])

  return (
    <div className="min-h-screen bg-slate-50" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <SiteHeader variant="home" showSearch={false} />
      <LocationModal />

      {/* Desktop: category strip. Mobile: search/AI usage instructions */}
      {isChosen && (
        <div className="bg-white border-b border-slate-100 shadow-sm sticky z-20" style={{ top: '72px' }}>
          <div className="container mx-auto px-4">
            {(category === 'restaurant' || category === 'cafe' || !category) && (
              <div className="hidden md:block">
                <CategoryIconsBar
                  activeSubcategoryId={subcategory || undefined}
                  category={category || 'restaurant'}
                />
              </div>
            )}
            <AnimatePresence mode="wait">
              {!hideMobileSearchTips && (
                <motion.div
                  key="search-instructions"
                  className="md:hidden overflow-hidden"
                  initial={{ opacity: 1, maxHeight: 280 }}
                  exit={{ opacity: 0, maxHeight: 0 }}
                  transition={{ duration: 0.28, ease: [0.2, 0, 0, 1] }}
                >
                  <div className="py-2 px-1">
                    <div className="rounded-2xl bg-gradient-to-br from-slate-50 to-amber-50/60 dark:from-slate-800/80 dark:to-amber-950/20 border border-slate-200/80 dark:border-slate-700/60 shadow-sm">
                      <button
                        type="button"
                        onClick={() => setSearchInstructionsOpen((o) => !o)}
                        aria-expanded={searchInstructionsOpen}
                        className="flex w-full items-center justify-between gap-2 rounded-2xl px-4 py-3 text-start transition-colors hover:bg-white/40 dark:hover:bg-slate-800/40"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="text-xl shrink-0" aria-hidden>
                            ✨
                          </span>
                          <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                            {t('How to use Search & AI Chat', 'كيفية استخدام البحث والمحادثة')}
                          </span>
                        </div>
                        <ChevronDown
                          className={cn(
                            'size-5 shrink-0 text-slate-600 transition-transform duration-200 dark:text-slate-300',
                            searchInstructionsOpen && 'rotate-180'
                          )}
                          aria-hidden
                        />
                      </button>
                      <AnimatePresence initial={false}>
                        {searchInstructionsOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }}
                            className="overflow-hidden"
                          >
                            <ul className="space-y-3 px-4 pb-4 pt-0">
                              <li className="flex items-start gap-3 rounded-xl border border-slate-100 bg-white/70 p-3 dark:border-slate-700/50 dark:bg-slate-800/50">
                                <span className="mt-0.5 shrink-0 text-xl" aria-hidden>
                                  🔍
                                </span>
                                <span className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                                  {t(
                                    'Type keywords (e.g. broast, pizza) to search businesses & products',
                                    'اكتب كلمات (مثل: بروست، بيتزا) للبحث عن الأعمال والمنتجات'
                                  )}
                                </span>
                              </li>
                              <li className="flex items-start gap-3 rounded-xl border border-slate-100 bg-white/70 p-3 dark:border-slate-700/50 dark:bg-slate-800/50">
                                <span className="mt-0.5 shrink-0 text-xl" aria-hidden>
                                  🍳
                                </span>
                                <span className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                                  {t(
                                    'Ask questions (e.g. How do I make an omelette?) for recipes & recommendations',
                                    'اسأل أسئلة (مثل: كيف أصنع أومليت؟) للحصول على وصفات وأوصيات'
                                  )}
                                </span>
                              </li>
                              <li className="flex items-start gap-3 rounded-xl border border-slate-100 bg-white/70 p-3 dark:border-slate-700/50 dark:bg-slate-800/50">
                                <span className="mt-0.5 shrink-0 text-xl" aria-hidden>
                                  👍
                                </span>
                                <span className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                                  {t(
                                    'Use the search bar at the bottom — easy to reach with your thumb',
                                    'استخدم شريط البحث أسفل الشاشة — سهل الوصول بإصبعك'
                                  )}
                                </span>
                              </li>
                            </ul>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      <main className="container mx-auto px-4 py-8 max-w-7xl md:py-8 max-md:pb-[calc(4rem+72px+max(16px,env(safe-area-inset-bottom,0px)))]">
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
            <h1 className="mb-6 text-2xl font-bold text-slate-900 max-md:mb-4">
              {showAIAssistantState
                ? t('Ask a question', 'اسأل سؤالاً')
                : categoryLabel
                  ? t('{category} in {city}', '{category} في {city}')
                      .replace('{category}', categoryLabel)
                      .replace('{city}', (getCityDisplayName(city ?? null, lang) || city) ?? '')
                  : t('All businesses in {city}', 'جميع الأعمال في {city}').replace(
                      '{city}',
                      (getCityDisplayName(city ?? null, lang) || city) ?? ''
                    )}
            </h1>

            {/* M3 Search Header - desktop: inline. Mobile: fixed above nav (see fixed bar below) */}
            <div className="mb-6 flex gap-3 items-center max-md:hidden">
              <div className="min-w-0 flex-1">
                <UniversalSearch
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder={t("e.g. Broast, pizza, or How to cook Broast", "مثال: بروست، بيتزا، أو كيف أطبخ البروست")}
                  inputClassName="h-14 rounded-full border-0 bg-slate-100/80 px-12 text-base shadow-inner focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-brand-red/50 transition-all font-medium placeholder:text-slate-400 placeholder:font-normal"
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
                    subcategory={subcategory}
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
                      subcategory={subcategory}
                      area={area}
                      setFilter={setFilter}
                      lang={lang}
                      t={t}
                    />
                  </div>
                )}

            {/* Note: In M3 Overhaul, the duplicate Specialty strip widget was removed because the top header (CategoryIconsBar) already solves this filtering natively and sticky-persists. */}

            {loading ? (
              <div className={BUSINESS_LISTING_CARD_GRID_CLASS}>
                {[...Array(8)].map((_, i) => (
                  <div
                    key={i}
                    className="h-[300px] animate-pulse rounded-[20px] bg-slate-200/60"
                  />
                ))}
              </div>
            ) : showSearchResults && searchResults ? (
              <>
                {/* View & sort controls - mobile-friendly */}
                {hasSearchResults && (
                  <div className="flex flex-wrap items-center justify-between gap-3 py-4 border-b border-slate-200/80">
                    {sortedSearchResults && sortedSearchResults.products.length > 0 && (
                      <div className="flex items-center gap-1 rounded-full bg-slate-100 p-1">
                        <button
                          type="button"
                          onClick={() => setProductViewMode('grid')}
                          className={`flex size-9 items-center justify-center rounded-full transition-colors ${
                            productViewMode === 'grid' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'
                          }`}
                          aria-label={t('Grid view', 'عرض شبكي')}
                        >
                          <LayoutGrid className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setProductViewMode('list')}
                          className={`flex size-9 items-center justify-center rounded-full transition-colors ${
                            productViewMode === 'list' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'
                          }`}
                          aria-label={t('List view', 'عرض قائمة')}
                        >
                          <List className="size-4" />
                        </button>
                      </div>
                    )}
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                      className="h-9 min-w-[140px] rounded-full border-0 bg-slate-100 px-4 text-sm font-medium text-slate-700 focus:ring-2 focus:ring-brand-red/30"
                    >
                      <option value="popularity">{t('Popularity', 'الأكثر طلباً')}</option>
                      <option value="relevance">{t('Relevance', 'الأكثر صلة')}</option>
                      <option value="name-asc">{t('Name A–Z', 'الاسم أ–ي')}</option>
                      <option value="name-desc">{t('Name Z–A', 'الاسم ي–أ')}</option>
                      <option value="price-asc">{t('Price: Low to High', 'السعر: من الأقل للأعلى')}</option>
                      <option value="price-desc">{t('Price: High to Low', 'السعر: من الأعلى للأقل')}</option>
                    </select>
                  </div>
                )}
                {/* Search results: Businesses first, then Products */}
                {hasSearchResults && sortedSearchResults ? (
                  <div className="space-y-8 pt-4">
                    {sortedSearchResults.businesses.length > 0 && (
                      <section>
                        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
                          {t('Businesses', 'الأعمال')}
                        </h2>
                        <div className={BUSINESS_LISTING_CARD_GRID_CLASS}>
                          {sortedSearchResults.businesses.map((b) => (
                            <BusinessListingCard
                              key={b._id}
                              href={b.slug ? `/t/${b.slug}` : '#'}
                              logoUrl={b.logoUrl}
                              displayName={(lang === 'ar' ? b.name_ar : b.name_en) || b.name}
                              businessType={b.businessType}
                              freeDeliveryEnabled={b.freeDeliveryEnabled}
                              rating={(b as any).rating}
                              lang={lang}
                              t={t}
                              useFullPageLink
                              titleTag="h3"
                            />
                          ))}
                        </div>
                      </section>
                    )}
                    {sortedSearchResults.products.length > 0 && (
                      <section>
                        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
                          {t('Products & meals', 'المنتجات والوجبات')}
                        </h2>
                        <div
                          className={
                            productViewMode === 'grid'
                              ? 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                              : 'flex flex-col gap-3'
                          }
                        >
                          {sortedSearchResults.products.map((p) => (
                            <div key={p._id}>
                              <FullPageLink
                                href={p.business.slug ? `/t/${p.business.slug}#product-${p._id}` : '#'}
                                className={`group flex overflow-hidden rounded-2xl bg-white shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] transition-all duration-300 hover:shadow-lg border border-transparent hover:border-slate-200 ${
                                  productViewMode === 'list' ? 'flex-row items-center gap-4 p-4' : 'flex-col'
                                }`}
                              >
                                <div className={`relative shrink-0 bg-slate-100 ${productViewMode === 'list' ? 'size-20 rounded-xl' : 'aspect-square sm:aspect-[4/3]'}`}>
                                  {p.imageUrl ? (
                                    <Image src={p.imageUrl} alt={(lang === 'ar' ? p.title_ar : p.title_en) || ''} fill className="object-cover" sizes={productViewMode === 'list' ? '80px' : '(max-width: 640px) 100vw, 280px'} />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center">
                                      <UtensilsCrossed className={productViewMode === 'list' ? 'size-8' : 'size-12'} />
                                    </div>
                                  )}
                                </div>
                                <div className={`min-w-0 flex-1 ${productViewMode === 'grid' ? 'p-4' : 'py-1'}`}>
                                  <h3 className={`font-bold text-slate-900 line-clamp-2 ${productViewMode === 'list' ? 'text-base' : 'text-lg'}`}>
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
                              </FullPageLink>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}
                  </div>
                ) : showAIAssistantState ? (
                  <div className="rounded-3xl border border-amber-200/60 bg-gradient-to-br from-amber-50/80 to-white dark:from-amber-950/20 dark:to-slate-900/50 p-12 text-center shadow-sm">
                    <div className="mx-auto mb-4 flex size-20 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
                      <Sparkles className="size-10 text-amber-600 dark:text-amber-400" />
                    </div>
                    <p className="text-lg font-semibold text-slate-800 dark:text-slate-200">
                      {t('Press Enter to ask — our AI will help', 'اضغط Enter للسؤال — الذكاء الاصطناعي سيساعدك')}
                    </p>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                      {t('Recipes, recommendations, and more for {city}', 'وصفات وأوصيات والمزيد في {city}').replace(
                        '{city}',
                        (getCityDisplayName(city ?? null, lang) || city) ?? ''
                      )}
                    </p>
                    <Button variant="outline" className="mt-6 rounded-full shadow-sm px-6 h-12 border-amber-300 text-amber-800 hover:bg-amber-50" onClick={() => setSearchQuery('')}>
                      {t('Clear and search differently', 'مسح والبحث بطريقة أخرى')}
                    </Button>
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
                <FullPageLink href="/" className="mt-6 inline-block">
                  <Button variant="outline" className="rounded-full shadow-sm px-6 h-12">
                    {t('Back to home', 'العودة للرئيسية')}
                  </Button>
                </FullPageLink>
              </div>
            ) : (
              <div className={`${BUSINESS_LISTING_CARD_GRID_CLASS} pt-4`}>
                {displayTenants.map((tenant) => (
                  <BusinessListingCard
                    key={tenant._id}
                    href={tenant.slug ? `/t/${tenant.slug}` : '#'}
                    logoUrl={tenant.logoUrl}
                    displayName={(lang === 'ar' ? tenant.name_ar : tenant.name_en) || tenant.name}
                    businessType={tenant.businessType}
                    freeDeliveryEnabled={tenant.freeDeliveryEnabled}
                    sections={tenant.sections}
                    rating={tenant.rating}
                    lang={lang}
                    t={t}
                    useFullPageLink
                    titleTag="h3"
                  />
                ))}
              </div>
            )}
                </div>
              </div>
          </>
        )}
      </main>

      {/* Mobile: fixed Search/AI bar above nav — thumb-zone friendly, results scroll above */}
      {isChosen && (
        <div
          className="md:hidden fixed left-0 right-0 z-30 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-t border-slate-200/90 dark:border-slate-800/80 px-4 py-3"
          style={{
            bottom: 'calc(72px + max(16px, env(safe-area-inset-bottom, 0px)))',
          }}
        >
          <div className="flex gap-3 items-center max-w-7xl mx-auto">
            <div className="min-w-0 flex-1">
              <UniversalSearch
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder={t("e.g. Broast, pizza, or How to cook Broast", "مثال: بروست، بيتزا، أو كيف أطبخ البروست")}
                anchorBottom
                inputClassName="h-12 rounded-full border-0 bg-slate-100/80 dark:bg-slate-800/80 px-4 text-sm shadow-inner focus-visible:bg-white dark:focus-visible:bg-slate-800 focus-visible:ring-2 focus-visible:ring-brand-red/50 transition-all font-medium placeholder:text-slate-400"
              />
            </div>
            <button
              type="button"
              onClick={() => setFiltersExpanded(!filtersExpanded)}
              className={`flex size-12 shrink-0 items-center justify-center rounded-full transition-all duration-300 ${
                filtersExpanded
                  ? 'bg-brand-yellow text-brand-black shadow-sm'
                  : 'bg-slate-100/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
              aria-label={t('Filters', 'الفلاتر')}
              aria-expanded={filtersExpanded}
            >
              <Filter className="size-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
