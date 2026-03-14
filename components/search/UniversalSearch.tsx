'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Search, X, Store, UtensilsCrossed, Loader2, Sparkles } from 'lucide-react'
import { useLocation } from '@/components/LocationContext'
import { useLanguage } from '@/components/LanguageContext'
import { cn } from '@/lib/utils'
import { SHIMMER_PLACEHOLDER } from '@/lib/image-placeholder'
import { isLikelyQuestion } from '@/lib/ai/question-detection'
import { SearchAIPanel } from './SearchAIPanel'
import { useSaveAiQuestion } from './useSaveAiQuestion'

type BusinessHit = {
  _id: string
  name: string
  name_en?: string | null
  name_ar?: string | null
  slug: string
  businessType: string
  logoUrl: string | null
}

type ProductHit = {
  _id: string
  title_en: string | null
  title_ar: string | null
  imageUrl: string | null
  price: number
  currency: string
  business: { name: string; slug: string; logoUrl: string | null }
}

const DEBOUNCE_MS = 180
const MIN_QUERY_LENGTH = 1

interface UniversalSearchProps {
  /** When inside a tenant page, scope search to that business. */
  tenantSlug?: string | null
  className?: string
  inputClassName?: string
  placeholder?: string
  /** Compact mode for mobile/menu. */
  compact?: boolean
}

export function UniversalSearch({
  tenantSlug,
  className,
  inputClassName,
  placeholder,
  compact = false,
}: UniversalSearchProps) {
  const { t, lang } = useLanguage()
  const { city, isChosen, setOpenLocationModal } = useLocation()
  const router = useRouter()
  const { saveQuestion } = useSaveAiQuestion()
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [aiSubmittedQuery, setAiSubmittedQuery] = useState<string | null>(null)
  const [pendingFollowUp, setPendingFollowUp] = useState<string | null>(null)
  const [results, setResults] = useState<{ businesses: BusinessHit[]; products: ProductHit[]; didYouMean: string | null } | null>(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const latestRequestRef = useRef(0)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [query])

  const isAIMode = isLikelyQuestion(debouncedQuery)

  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < MIN_QUERY_LENGTH) {
      setResults(null)
      setLoading(false)
      return
    }
    if (isAIMode) {
      setResults(null)
      setLoading(false)
      return
    }
    if (!tenantSlug && (!city || !isChosen)) {
      setResults(null)
      setLoading(false)
      return
    }
    let mounted = true
    const requestId = ++latestRequestRef.current
    setResults(null)
    setLoading(true)
    const ac = new AbortController()
    const doFetch = async () => {
      try {
        if (tenantSlug) {
          const res = await fetch(`/api/tenants/${encodeURIComponent(tenantSlug)}/search?q=${encodeURIComponent(debouncedQuery)}&limit=20&lang=${lang === 'ar' ? 'ar' : 'en'}`, { signal: ac.signal })
          const data = await res.json()
          if (mounted && latestRequestRef.current === requestId) {
            setResults({ businesses: [], products: data?.products ?? [], didYouMean: data?.didYouMean ?? null })
          }
        } else {
          const params = new URLSearchParams({ city: city!, q: debouncedQuery, lang: lang === 'ar' ? 'ar' : 'en' })
          const res = await fetch(`/api/home/search?${params}`, { signal: ac.signal })
          const data = await res.json()
          if (mounted && latestRequestRef.current === requestId) {
            setResults({ businesses: data?.businesses ?? [], products: data?.products ?? [], didYouMean: data?.didYouMean ?? null })
          }
        }
      } catch (err) {
        if (mounted && latestRequestRef.current === requestId && (err as Error)?.name !== 'AbortError') {
          setResults(null)
        }
      } finally {
        if (mounted && latestRequestRef.current === requestId) setLoading(false)
      }
    }
    doFetch()
    return () => { mounted = false; ac.abort() }
  }, [debouncedQuery, tenantSlug, city, isChosen, lang, isAIMode])

  const totalItems = (results?.businesses?.length ?? 0) + (results?.products?.length ?? 0)
  const showDropdown = open && (query.trim().length >= MIN_QUERY_LENGTH || !!aiSubmittedQuery)
  const canShowAI = (isAIMode || aiSubmittedQuery) && city && isChosen && !tenantSlug
  const showAIPanel = canShowAI && aiSubmittedQuery
  const flatItems: Array<{ type: 'business'; item: BusinessHit } | { type: 'product'; item: ProductHit }> = [
    ...(results?.businesses ?? []).map((b) => ({ type: 'business' as const, item: b })),
    ...(results?.products ?? []).map((p) => ({ type: 'product' as const, item: p })),
  ]

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
        setFocusedIndex(-1)
        setAiSubmittedQuery(null)
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!showDropdown) return
      if (e.key === 'Escape') {
        setOpen(false)
        setFocusedIndex(-1)
        setAiSubmittedQuery(null)
        inputRef.current?.blur()
        return
      }
      if (canShowAI && !aiSubmittedQuery) {
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setFocusedIndex((prev) => (prev < flatItems.length - 1 ? prev + 1 : prev))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setFocusedIndex((prev) => (prev > 0 ? prev - 1 : -1))
      } else if (e.key === 'Enter') {
        if (focusedIndex >= 0 && flatItems[focusedIndex]) {
          e.preventDefault()
          const { type, item } = flatItems[focusedIndex]
          if (type === 'business') router.push(`/t/${(item as BusinessHit).slug}`)
          else router.push(`/t/${(item as ProductHit).business.slug}#product-${(item as ProductHit)._id}`)
          setOpen(false)
          setQuery('')
        }
        // When in AI follow-up mode with no selection, let form submit (don't preventDefault)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showDropdown, focusedIndex, flatItems, router, canShowAI, aiSubmittedQuery])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    if (tenantSlug) {
      router.push(`/t/${tenantSlug}?q=${encodeURIComponent(q)}`)
      setOpen(false)
      setQuery('')
      return
    }
    if (canShowAI) {
      saveQuestion(q)
      if (aiSubmittedQuery) {
        setPendingFollowUp(q)
        setQuery('')
        inputRef.current?.focus()
      } else {
        setAiSubmittedQuery(q)
        setQuery('')
        setOpen(true)
        inputRef.current?.focus()
      }
      return
    }
    router.push(`/search?q=${encodeURIComponent(q)}`)
    setOpen(false)
    setQuery('')
  }

  const clearFollowUp = useCallback(() => setPendingFollowUp(null), [])

  const applyDidYouMean = () => {
    if (results?.didYouMean) {
      setQuery(results.didYouMean)
      setFocusedIndex(-1)
      inputRef.current?.focus()
    }
  }

  const defaultPlaceholder = tenantSlug
    ? t('Search menu...', 'ابحث في القائمة...')
    : t('Search businesses or items...', 'ابحث عن أعمال أو أصناف...')

  if (!tenantSlug && (!city || !isChosen)) {
    return (
      <button
        type="button"
        onClick={() => setOpenLocationModal(true)}
        className={cn(
          'flex items-center gap-2 rounded-full bg-slate-100 px-4 py-3 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-200',
          compact && 'px-3 py-2 text-xs',
          inputClassName
        )}
      >
        <Search className="size-4 shrink-0" />
        {t('Choose location to search', 'اختر الموقع للبحث')}
      </button>
    )
  }

  return (
    <div ref={wrapperRef} className={cn('relative w-full', className)}>
      <form onSubmit={handleSubmit} className="relative group">
        <Search className="absolute start-4 top-1/2 size-5 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
        <input
          ref={inputRef}
          type="search"
          autoComplete="off"
          role="combobox"
          aria-expanded={!!showDropdown}
          aria-autocomplete="list"
          placeholder={aiSubmittedQuery ? (placeholder ?? t('Ask a follow-up...', 'اسأل سؤالاً إضافياً...')) : (placeholder ?? defaultPlaceholder)}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setResults(null)
            if (!aiSubmittedQuery) setAiSubmittedQuery(null)
            setOpen(true)
            setFocusedIndex(-1)
          }}
          onFocus={() => setOpen(true)}
          className={cn(
            'w-full rounded-full bg-slate-100 px-11 py-3 text-sm font-medium text-slate-900 outline-none transition-all placeholder:text-slate-500 focus:bg-white focus:ring-2 focus:ring-brand-yellow/50 focus:shadow-sm',
            compact && 'py-2 px-10 text-xs',
            inputClassName
          )}
        />
        {(query || loading) && (
          <div className="absolute end-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {loading && <Loader2 className="size-4 animate-spin text-slate-400" />}
            {query && (
              <button
                type="button"
                onClick={() => {
                  latestRequestRef.current += 1
                  setQuery('')
                  setResults(null)
                  setAiSubmittedQuery(null)
                  setLoading(false)
                  inputRef.current?.focus()
                }}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200"
                aria-label={t('Clear', 'مسح')}
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        )}
      </form>

      {showDropdown && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-200 max-h-[min(400px,70vh)] overflow-hidden z-[100] flex flex-col">
            {showAIPanel ? (
              <SearchAIPanel
                query={aiSubmittedQuery!}
                city={city!}
                followUp={pendingFollowUp}
                onFollowUpSent={clearFollowUp}
                onSaveQuestion={saveQuestion}
                onClose={() => { setOpen(false); setAiSubmittedQuery(null); setPendingFollowUp(null) }}
              />
            ) : canShowAI ? (
              <div className="p-4 flex flex-col gap-3">
                <div className="flex items-center gap-2 text-amber-600">
                  <Sparkles className="size-4 shrink-0" />
                  <span className="text-sm font-medium text-slate-700">
                    {t('Ask AI', 'اسأل الذكاء الاصطناعي')}
                  </span>
                </div>
                <p className="text-sm text-slate-600">
                  {t('Type your question, then press Enter to ask.', 'اكتب سؤالك واضغط Enter للسؤال.')}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const q = query.trim()
                    if (q) {
                      saveQuestion(q)
                      setAiSubmittedQuery(q)
                    }
                  }}
                  className="self-start inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 transition-colors"
                >
                  <Sparkles className="size-4" />
                  {t('Ask', 'اسأل')}
                </button>
              </div>
            ) : loading && debouncedQuery ? (
              <div className="flex items-center justify-center gap-2 py-12 text-slate-500">
                <Loader2 className="size-5 animate-spin" />
                <span className="text-sm">{t('Searching...', 'جاري البحث...')}</span>
              </div>
            ) : results?.didYouMean && totalItems === 0 ? (
              <div className="p-4">
                <p className="text-sm text-slate-600 font-medium">
                  {t('Did you mean', 'هل تقصد')}{' '}
                  <button
                    type="button"
                    onClick={applyDidYouMean}
                    className="text-brand-yellow font-bold underline underline-offset-2 hover:text-amber-600"
                  >
                    {results.didYouMean}
                  </button>
                  ?
                </p>
              </div>
            ) : totalItems > 0 ? (
              <div className="p-2">
                {results?.businesses && results.businesses.length > 0 && (
                  <>
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider px-3 py-2">
                      {t('Businesses', 'الأعمال')}
                    </div>
                    {results.businesses.map((b, i) => {
                      const idx = i
                      const name = lang === 'ar' ? (b.name_ar ?? b.name_en ?? b.name) : (b.name_en ?? b.name_ar ?? b.name)
                      return (
                        <Link
                          key={b._id}
                          href={`/t/${b.slug}`}
                          onClick={() => { setOpen(false); setQuery('') }}
                          onMouseEnter={() => setFocusedIndex(idx)}
                          className={cn(
                            'flex items-center gap-3 p-3 rounded-xl transition-colors',
                            focusedIndex === idx ? 'bg-slate-100' : 'hover:bg-slate-50'
                          )}
                        >
                          <div className="relative size-12 shrink-0 rounded-xl overflow-hidden bg-slate-100">
                            {b.logoUrl ? (
                              <Image src={b.logoUrl} alt={name} fill className="object-contain p-1" sizes="48px" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center">
                                <Store className="size-6 text-slate-400" />
                              </div>
                            )}
                          </div>
                          <span className="font-semibold text-slate-900 truncate">{name}</span>
                        </Link>
                      )
                    })}
                  </>
                )}
                {results?.products && results.products.length > 0 && (
                  <>
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider px-3 py-2 mt-1">
                      {t('Products', 'المنتجات')}
                    </div>
                    {results.products.map((p, i) => {
                      const idx = (results?.businesses?.length ?? 0) + i
                      const title = lang === 'ar' ? (p.title_ar ?? p.title_en) : (p.title_en ?? p.title_ar)
                      return (
                        <Link
                          key={p._id}
                          href={`/t/${p.business.slug}#product-${p._id}`}
                          onClick={() => { setOpen(false); setQuery('') }}
                          onMouseEnter={() => setFocusedIndex(idx)}
                          className={cn(
                            'flex items-center gap-3 p-3 rounded-xl transition-colors',
                            focusedIndex === idx ? 'bg-slate-100' : 'hover:bg-slate-50'
                          )}
                        >
                          <div className="relative size-14 shrink-0 rounded-lg overflow-hidden bg-slate-100">
                            {p.imageUrl ? (
                              <Image src={p.imageUrl} alt={title ?? ''} fill className="object-cover" sizes="56px" placeholder="blur" blurDataURL={SHIMMER_PLACEHOLDER} />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center">
                                <UtensilsCrossed className="size-6 text-slate-400" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-slate-900 truncate">{title}</p>
                            <p className="text-xs text-slate-500">{p.business.name}</p>
                            {p.price > 0 && (
                              <p className="text-sm font-bold text-slate-700 mt-0.5">
                                {p.price} {p.currency}
                              </p>
                            )}
                          </div>
                        </Link>
                      )
                    })}
                  </>
                )}
              </div>
            ) : query.trim() && !loading ? (
              <div className="p-6 text-center text-slate-500 text-sm">
                {t('No results found. Try a different search.', 'لم يتم العثور على نتائج. جرب مصطلح بحث مختلف.')}
              </div>
            ) : null}
          </div>
        )}
    </div>
  )
}
