'use client'

/**
 * AI search panel (Sheet overlay). Uses <a> for business/product cards: Link causes
 * freeze when navigating from inside a Sheet. Prefer Link elsewhere for fast SPA nav.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import type { UIMessage } from 'ai'
import { Loader2, Sparkles, Store, ShoppingCart, Send, RotateCcw, X, Check } from 'lucide-react'
import { motion } from 'framer-motion'
import { useLanguage } from '@/components/LanguageContext'
import { useCart } from '@/components/Cart/CartContext'
import { useToast } from '@/components/ui/ToastProvider'
import { cn } from '@/lib/utils'
import { SHIMMER_PLACEHOLDER } from '@/lib/image-placeholder'
import { SanitizedMarkdown } from '@/components/ai/SanitizedMarkdown'
import type { Product } from '@/app/types/menu'
import type { ToolProduct, ToolBusiness, StoreOption } from '@/lib/ai/search-tools'
import { BUSINESS_TYPES } from '@/lib/constants'

const CHAT_STORAGE_PREFIX = 'zonify-ai-chat-'

function loadStoredMessages(city: string): UIMessage[] {
  if (typeof window === 'undefined' || !city) return []
  try {
    const raw = localStorage.getItem(`${CHAT_STORAGE_PREFIX}${city}`)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveStoredMessages(city: string, messages: UIMessage[]) {
  if (typeof window === 'undefined' || !city) return
  try {
    localStorage.setItem(`${CHAT_STORAGE_PREFIX}${city}`, JSON.stringify(messages))
  } catch (e) {
    console.warn('[SearchAIPanel] Failed to persist chat:', e)
  }
}

function clearStoredMessages(city: string) {
  if (typeof window === 'undefined' || !city) return
  try {
    localStorage.removeItem(`${CHAT_STORAGE_PREFIX}${city}`)
  } catch {}
}

interface SearchAIPanelProps {
  /** Initial question (sent on first load) */
  query: string
  city: string
  country?: string
  /** Follow-up message from parent (sent when user submits again) */
  followUp?: string | null
  onFollowUpSent?: () => void
  onClose?: () => void
  /** Called when user sends a question (for saving to profile) */
  onSaveQuestion?: (question: string) => void
  className?: string
  /** When true, limit height (dropdown). When false, fill available space (drawer/modal). */
  fullHeight?: boolean
}

function getTextFromParts(parts: Array<{ type?: string; text?: string }> | undefined): string {
  if (!parts?.length) return ''
  const textPart = parts.find((p) => p.type === 'text')
  return typeof (textPart as { text?: string })?.text === 'string' ? (textPart as { text: string }).text : ''
}

export function SearchAIPanel({
  query,
  city,
  country = '',
  followUp,
  onFollowUpSent,
  onClose,
  onSaveQuestion,
  className,
  fullHeight = false,
}: SearchAIPanelProps) {
  const { lang } = useLanguage()
  const { addToCart, cartTenant, items } = useCart()
  const { showToast } = useToast()
  const containerRef = useRef<HTMLDivElement>(null)
  const [replyInput, setReplyInput] = useState('')
  const replyInputRef = useRef<HTMLInputElement>(null)
  const [addingProductId, setAddingProductId] = useState<string | null>(null)
  const [addedProductId, setAddedProductId] = useState<string | null>(null)
  const [addingAllFromKey, setAddingAllFromKey] = useState<string | null>(null)
  /** When user picks a store from store cards, we fetch and cache products per part */
  const [storeChoiceResults, setStoreChoiceResults] = useState<
    Record<string, { products: ToolProduct[]; byStore: Record<string, ToolProduct[]>; missingIngredients: string[] }>
  >({})
  const [loadingStoreSlug, setLoadingStoreSlug] = useState<string | null>(null)
  const addToCartFetchRef = useRef<AbortController | null>(null)
  const addAllFromStoreFetchRef = useRef<AbortController | null>(null)
  const ingredientsByStoreFetchRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => {
      addToCartFetchRef.current?.abort()
      addAllFromStoreFetchRef.current?.abort()
      ingredientsByStoreFetchRef.current?.abort()
    }
  }, [])

  const initialMessages = useMemo(() => loadStoredMessages(city), [city])

  const { messages, sendMessage, setMessages, status } = useChat({
    id: `search-ai-${city}`,
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: '/api/search/chat',
      body: { city, country, lang: lang === 'ar' ? 'ar' : 'en' },
    }),
  })

  useEffect(() => {
    if (messages.length === 0) return
    saveStoredMessages(city, messages)
  }, [city, messages])

  const lastSentKey = useRef('')
  useEffect(() => {
    if (!query.trim() || query === '__resume__' || !city) return
    if (messages.length > 0) return
    const key = `initial:${city}:${query}`
    if (lastSentKey.current === key) return
    lastSentKey.current = key
    sendMessage({ text: query })
  }, [query, city, sendMessage, messages.length])

  const handleResetChat = () => {
    clearStoredMessages(city)
    lastSentKey.current = ''
    setMessages([])
    setReplyInput('')
    replyInputRef.current?.focus()
  }

  const lastFollowUpRef = useRef('')
  useEffect(() => {
    if (!followUp?.trim() || !city) return
    if (lastFollowUpRef.current === followUp.trim()) return
    lastFollowUpRef.current = followUp.trim()
    sendMessage({ text: followUp.trim() })
    onFollowUpSent?.()
  }, [followUp, city, sendMessage, onFollowUpSent])

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [messages])

  const loading = status === 'streaming' || status === 'submitted'
  const t = (en: string, ar: string) => (lang === 'ar' ? ar : en)

  const handleSendReply = (e?: React.FormEvent) => {
    e?.preventDefault()
    const text = replyInput.trim()
    if (!text || loading) return
    onSaveQuestion?.(text)
    sendMessage({ text })
    setReplyInput('')
    replyInputRef.current?.focus()
  }

  const handleAddToCart = async (p: ToolProduct) => {
    setAddingProductId(p._id)
    addToCartFetchRef.current?.abort()
    const ac = new AbortController()
    addToCartFetchRef.current = ac
    try {
      const res = await fetch(`/api/search/product/${p._id}`, { signal: ac.signal })
      if (!res.ok) throw new Error('Failed to fetch product')
      const { product, tenant } = await res.json()
      if (!product || !tenant?.slug) throw new Error('Invalid product data')

      const willConflict = items.length > 0 && cartTenant?.slug && tenant.slug && cartTenant.slug !== tenant.slug
      addToCart(product as Product, [], [], {
        slug: tenant.slug,
        name: tenant.name,
      })

      if (willConflict) {
        setAddingProductId(null)
        return
      }

      setAddingProductId(null)
      setAddedProductId(p._id)
      setTimeout(() => setAddedProductId(null), 800)
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') {
        setAddingProductId(null)
        return
      }
      console.error('Add to cart:', e)
      setAddingProductId(null)
      showToast(
        t('Could not add item. Try again.', 'تعذر إضافة الصنف. حاول مرة أخرى.'),
        t('Could not add item. Try again.', 'تعذر إضافة الصنف. حاول مرة أخرى.'),
        'error'
      )
    }
  }

  return (
    <div className={cn('flex flex-col', className)}>
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-200 bg-slate-50/80 shrink-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex size-9 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-200/80 hover:text-slate-800 transition-colors"
              aria-label={t('Close', 'إغلاق')}
            >
              <X className="size-5" />
            </button>
          )}
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="size-4 shrink-0 text-amber-500" />
            <span className="text-sm font-medium text-slate-700 truncate">
              {t('AI assistant', 'المساعد الذكي')}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={handleResetChat}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200/80 hover:text-slate-800 transition-colors"
          aria-label={t('New chat', 'محادثة جديدة')}
        >
          <RotateCcw className="size-3.5" />
          {t('New chat', 'محادثة جديدة')}
        </button>
      </div>

      {/* Banner: Cart has items — explain cross-store limitation. High contrast, sticky so always visible. */}
      {items.length > 0 && cartTenant && (
        <div
          className="sticky top-0 z-10 shrink-0 mx-4 mt-2 mb-2 rounded-xl border-2 border-amber-500 bg-amber-100 px-4 py-3 shadow-sm"
          role="alert"
        >
          <p className="text-sm font-bold text-amber-950">
            {t('Cart has items from', 'سلتك تحتوي على أصناف من')}{' '}
            <span className="underline">{cartTenant.name}</span>
          </p>
          <p className="text-xs text-amber-900 mt-1">
            {t(
              'Products from other restaurants show an "Add" with a warning. Tap to choose: replace cart or go back.',
              'أصناف من مطاعم أخرى تظهر زر "أضف" مع تحذير. اضغط لاختيار: استبدال السلة أو العودة.'
            )}
          </p>
        </div>
      )}
      <div
        ref={containerRef}
        className={cn(
          'flex-1 overflow-y-auto px-4 py-4 pb-8 min-h-[120px]',
          fullHeight ? 'min-h-0' : 'max-h-[320px]'
        )}
      >
        {loading && messages.length === 0 && (
          <div className="flex items-center gap-2 text-slate-500">
            <Loader2 className="size-4 animate-spin" />
            <span className="text-sm">{t('Thinking...', 'جاري التفكير...')}</span>
          </div>
        )}

        {messages.map((message) => {
          if (message.role === 'user') {
            const text = getTextFromParts(message.parts)
            if (!text) return null
            return (
              <div key={message.id} className="flex justify-end mb-3">
                <div
                  className="max-w-[85%] px-3 py-2 rounded-2xl rounded-br-md bg-amber-500/90 text-white text-sm"
                  dir={lang === 'ar' ? 'rtl' : 'ltr'}
                >
                  {text}
                </div>
              </div>
            )
          }
          if (message.role !== 'assistant') return null
          return (
            <div key={message.id} className="space-y-3 mb-3 flex flex-col items-start">
              {(message.parts ?? []).map((part, idx) => {
                if (part.type === 'text') {
                  return (
                    <SanitizedMarkdown
                      key={idx}
                      content={part.text ?? ''}
                      className="ai-prose px-1"
                      dir={lang === 'ar' ? 'rtl' : 'ltr'}
                    />
                  )
                }
                if (part.type === 'tool-search_ingredients') {
                  if (part.state !== 'output-available' || !part.output) return null
                  const data = part.output as {
                    products?: ToolProduct[]
                    byStore?: Record<string, ToolProduct[]>
                    storeOptions?: StoreOption[]
                    soughtIngredients?: string[]
                    matchedIngredients?: string[]
                    missingIngredients?: string[]
                  }
                  const storeOptions = data.storeOptions ?? []
                  const hasMultipleStores = storeOptions.length >= 2
                  const partKey = `${message.id}-ingredients-${idx}`
                  const chosenResult = storeChoiceResults[partKey]

                  if (chosenResult) {
                    const products = chosenResult.products
                    const byStore = chosenResult.byStore
                    const missing = chosenResult.missingIngredients ?? []
                    if (products.length === 0) {
                      return (
                        <div key={idx} className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                          <p className="text-sm font-medium text-amber-800">
                            {t('No matching ingredients in this store.', 'لا توجد مكونات مطابقة في هذا المتجر.')}
                          </p>
                        </div>
                      )
                    }
                    const displayProducts = Object.values(byStore).flat()
                    return (
                      <div key={idx} className="space-y-2 mt-3">
                        {missing.length > 0 && (
                          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2">
                            <p className="text-xs font-medium text-amber-800">
                              {t('Some ingredients from the recipe are not available in our stores:', 'بعض مكونات الوصفة غير متوفرة في متاجرنا:')}
                            </p>
                            <p className="mt-1 text-xs text-amber-700">{missing.join(', ')}</p>
                          </div>
                        )}
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                          {t('Ingredients from chosen store', 'المكونات من المتجر المختار')}
                        </p>
                        {Object.entries(byStore).map(([storeSlug, storeProds]) => (
                          <div key={String(storeSlug)} className="space-y-2">
                            {storeProds.length > 1 && (
                              <motion.button
                                type="button"
                                disabled={!!addingAllFromKey}
                                whileTap={!addingAllFromKey ? { scale: 0.95 } : undefined}
                                onClick={async () => {
                                  const key = String(storeSlug)
                                  setAddingAllFromKey(key)
                                  try {
                                    addAllFromStoreFetchRef.current?.abort()
                                    const batchAc = new AbortController()
                                    addAllFromStoreFetchRef.current = batchAc
                                    for (const prod of storeProds) {
                                      const res = await fetch(`/api/search/product/${prod._id}`, { signal: batchAc.signal })
                                      if (res.ok) {
                                        const { product, tenant } = await res.json()
                                        if (product && tenant?.slug) {
                                          const willConflict = items.length > 0 && cartTenant?.slug && tenant.slug && cartTenant.slug !== tenant.slug
                                          addToCart(product as Product, [], [], { slug: tenant.slug, name: tenant.name })
                                          if (willConflict) break
                                        }
                                      }
                                    }
                                  } catch (e) {
                                    if ((e as Error)?.name === 'AbortError') return
                                    console.error('Add to cart:', e)
                                    showToast(
                                      t('Could not add items. Try again.', 'تعذر إضافة الأصناف. حاول مرة أخرى.'),
                                      t('Could not add items. Try again.', 'تعذر إضافة الأصناف. حاول مرة أخرى.'),
                                      'error'
                                    )
                                  } finally {
                                    setAddingAllFromKey(null)
                                  }
                                }}
                                className={cn(
                                  'text-xs font-bold flex items-center gap-1 transition-opacity',
                                  addingAllFromKey === String(storeSlug)
                                    ? 'text-amber-500 opacity-70'
                                    : 'text-amber-600 hover:text-amber-700'
                                )}
                              >
                                {addingAllFromKey === String(storeSlug) ? (
                                  <Loader2 className="size-3.5 animate-spin" />
                                ) : (
                                  <ShoppingCart className="size-3.5" />
                                )}
                                {addingAllFromKey === String(storeSlug) ? t('Adding…', 'جاري الإضافة…') : `${t('Add all from', 'أضف الكل من')} ${(lang === 'ar' && storeProds[0]?.businessName_ar ? storeProds[0].businessName_ar : storeProds[0]?.businessName) ?? ''}`}
                              </motion.button>
                            )}
                            {storeProds.slice(0, 12).map((p) => {
                              const title = lang === 'ar' ? (p.title_ar ?? p.title_en) : (p.title_en ?? p.title_ar)
                              const businessDisplayName = lang === 'ar' && p.businessName_ar ? p.businessName_ar : p.businessName
                              const isDifferentStore = items.length > 0 && cartTenant?.slug && p.businessSlug && cartTenant.slug !== p.businessSlug
                              return (
                                <div
                                  key={p._id}
                                  className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200"
                                >
                                  <div className="flex min-w-0 flex-1 items-center gap-3">
                                    <div className="relative size-14 shrink-0 rounded-lg overflow-hidden bg-slate-100">
                                      {p.imageUrl ? (
                                        <Image
                                          src={p.imageUrl}
                                          alt={title ?? ''}
                                          fill
                                          className="object-cover"
                                          sizes="56px"
                                          placeholder="blur"
                                          blurDataURL={SHIMMER_PLACEHOLDER}
                                        />
                                      ) : (
                                        <div className="flex h-full w-full items-center justify-center">
                                          <Store className="size-6 text-slate-400" />
                                        </div>
                                      )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="font-semibold text-slate-900 truncate">{title}</p>
                                      <p className="text-xs text-slate-500 flex items-center gap-1.5" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                                        {businessDisplayName}
                                        {isDifferentStore && (
                                          <span className="inline-flex items-center rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">
                                            {t('Different store', 'متجر آخر')}
                                          </span>
                                        )}
                                        {p.businessOpenNow && !isDifferentStore && (
                                          <span className="inline-flex items-center rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                                            {t('Open', 'مفتوح')}
                                          </span>
                                        )}
                                      </p>
                                      {p.price > 0 && (
                                        <p className="text-sm font-bold text-slate-700 mt-0.5">
                                          {p.price} {p.currency}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex shrink-0 gap-2 flex-wrap">
                                    <a
                                      href={`/t/${p.businessSlug}#product-${p._id}`}
                                      className="text-xs font-medium text-amber-600 hover:text-amber-700"
                                    >
                                      {t('View menu', 'عرض القائمة')}
                                    </a>
                                    <motion.button
                                      type="button"
                                      onClick={() => handleAddToCart(p)}
                                      disabled={addingProductId === p._id}
                                      title={isDifferentStore ? t('Cart has items from another restaurant. Tap to choose: replace cart or go back.', 'سلتك تحتوي على أصناف من مطعم آخر. اضغط لاختيار: استبدال السلة أو العودة.') : undefined}
                                      whileTap={addingProductId !== p._id ? { scale: 0.95 } : undefined}
                                      className={cn(
                                        'inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors',
                                        addedProductId === p._id
                                          ? 'bg-emerald-500 text-white'
                                          : isDifferentStore
                                            ? 'bg-amber-200 text-amber-950 border-2 border-amber-500 hover:bg-amber-300'
                                            : 'text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-70'
                                      )}
                                    >
                                      {addingProductId === p._id ? (
                                        <Loader2 className="size-3 animate-spin" />
                                      ) : addedProductId === p._id ? (
                                        <Check className="size-3" />
                                      ) : (
                                        <ShoppingCart className="size-3" />
                                      )}
                                      {addingProductId === p._id ? t('Adding…', 'جاري الإضافة…') : addedProductId === p._id ? t('Added', 'تمت الإضافة') : t('Add', 'أضف')}
                                    </motion.button>
                                  </div>
                                </div>
                              )
                            })}
                            </div>
                          ))}
                        </div>
                      )
                  }

                  if (hasMultipleStores) {
                    return (
                      <div key={idx} className="space-y-3 mt-3">
                        {data.missingIngredients && data.missingIngredients.length > 0 && (
                          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2">
                            <p className="text-xs font-medium text-amber-800">
                              {t('Some ingredients from the recipe are not available in our stores:', 'بعض مكونات الوصفة غير متوفرة في متاجرنا:')}
                            </p>
                            <p className="mt-1 text-xs text-amber-700">{data.missingIngredients.join(', ')}</p>
                          </div>
                        )}
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                          {t('Ingredients are available in these stores. Pick one to see products:', 'المكونات متوفرة في هذه المتاجر. اختر متجراً لعرض المنتجات:')}
                        </p>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {storeOptions.map((s) => {
                            const displayName = (lang === 'ar' && s.name_ar ? s.name_ar : s.name) || s.name
                            return (
                              <motion.button
                                key={s.slug}
                                type="button"
                                disabled={loadingStoreSlug !== null}
                                whileTap={loadingStoreSlug === null ? { scale: 0.98 } : undefined}
                                onClick={async () => {
                                  setLoadingStoreSlug(s.slug)
                                  try {
                                    ingredientsByStoreFetchRef.current?.abort()
                                    const fetchAc = new AbortController()
                                    ingredientsByStoreFetchRef.current = fetchAc
                                    const res = await fetch('/api/search/ingredients-by-store', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({
                                        ingredients: data.soughtIngredients ?? [],
                                        storeSlug: s.slug,
                                        city,
                                        country,
                                      }),
                                      signal: fetchAc.signal,
                                    })
                                    if (res.ok) {
                                      const result = await res.json()
                                      setStoreChoiceResults((prev) => ({
                                        ...prev,
                                        [partKey]: {
                                          products: result.products ?? [],
                                          byStore: result.byStore ?? {},
                                          missingIngredients: result.missingIngredients ?? [],
                                        },
                                      }))
                                    }
                                  } catch (e) {
                                    if ((e as Error)?.name === 'AbortError') return
                                    console.error('Store choice fetch:', e)
                                    showToast(
                                      t('Could not load products. Try again.', 'تعذر تحميل المنتجات. حاول مرة أخرى.'),
                                      t('Could not load products. Try again.', 'تعذر تحميل المنتجات. حاول مرة أخرى.'),
                                      'error'
                                    )
                                  } finally {
                                    setLoadingStoreSlug(null)
                                  }
                                }}
                                className={cn(
                                  'flex flex-col items-center p-4 rounded-xl border-2 transition-all',
                                  'bg-white border-slate-200 hover:border-amber-400 hover:shadow-md',
                                  loadingStoreSlug === s.slug && 'opacity-70'
                                )}
                              >
                                {loadingStoreSlug === s.slug ? (
                                  <Loader2 className="size-10 text-amber-500 animate-spin mb-2" />
                                ) : (
                                  <Store className="size-10 text-amber-500 mb-2" />
                                )}
                                <span className="font-bold text-slate-900 text-sm line-clamp-2 text-center" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                                  {displayName}
                                </span>
                                <span className="text-xs text-slate-500 mt-0.5">
                                  {s.productCount} {t('products', 'منتج')}
                                </span>
                              </motion.button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  }

                  const products = data.products ?? Object.values(data.byStore ?? {}).flat()
                  const missing = data.missingIngredients ?? []
                  if (products.length === 0) {
                    return (
                      <div key={idx} className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                        <p className="text-sm font-medium text-amber-800">
                          {t('No matching ingredients found in our stores.', 'لم يتم العثور على هذه المكونات في متاجرنا.')}
                        </p>
                        {missing.length > 0 ? (
                          <p className="mt-1 text-xs text-amber-700">
                            {t('Ingredients from the recipe not available:', 'مكونات الوصفة غير متوفرة:')} {missing.join(', ')}
                          </p>
                        ) : (data.soughtIngredients ?? []).length > 0 ? (
                          <p className="mt-1 text-xs text-amber-700">
                            {t('Searched for:', 'تم البحث عن:')} {(data.soughtIngredients ?? []).join(', ')}
                          </p>
                        ) : null}
                      </div>
                    )
                  }
                  const byStore = data.byStore ?? {}
                  const hasByStore = Object.keys(byStore).length > 0
                  const displayProducts = hasByStore ? Object.values(byStore).flat() : products
                  return (
                    <div key={idx} className="space-y-2 mt-3">
                      {missing.length > 0 && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2">
                          <p className="text-xs font-medium text-amber-800">
                            {t('Some ingredients from the recipe are not available in our stores:', 'بعض مكونات الوصفة غير متوفرة في متاجرنا:')}
                          </p>
                          <p className="mt-1 text-xs text-amber-700">{missing.join(', ')}</p>
                        </div>
                      )}
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        {t('Ingredients found', 'المكونات المتوفرة')}
                      </p>
                      {(hasByStore ? Object.entries(byStore) : [['_flat', products] as [string, ToolProduct[]]]).map(([storeSlug, storeProds]) => (
                        <div key={String(storeSlug)} className="space-y-2">
                          {storeProds.length > 1 && hasByStore && (
                            <motion.button
                              type="button"
                              disabled={!!addingAllFromKey}
                              whileTap={!addingAllFromKey ? { scale: 0.95 } : undefined}
                              onClick={async () => {
                                const key = String(storeSlug)
                                setAddingAllFromKey(key)
                                try {
                                  addAllFromStoreFetchRef.current?.abort()
                                  const batchAc = new AbortController()
                                  addAllFromStoreFetchRef.current = batchAc
                                  for (const prod of storeProds) {
                                    const res = await fetch(`/api/search/product/${prod._id}`, { signal: batchAc.signal })
                                    if (res.ok) {
                                      const { product, tenant } = await res.json()
                                      if (product && tenant?.slug) {
                                        const willConflict = items.length > 0 && cartTenant?.slug && tenant.slug && cartTenant.slug !== tenant.slug
                                        addToCart(product as Product, [], [], { slug: tenant.slug, name: tenant.name })
                                        if (willConflict) break
                                      }
                                    }
                                  }
                                } catch (e) {
                                  if ((e as Error)?.name === 'AbortError') return
                                  console.error('Add to cart:', e)
                                  showToast(
                                    t('Could not add items. Try again.', 'تعذر إضافة الأصناف. حاول مرة أخرى.'),
                                    t('Could not add items. Try again.', 'تعذر إضافة الأصناف. حاول مرة أخرى.'),
                                    'error'
                                  )
                                } finally {
                                  setAddingAllFromKey(null)
                                }
                              }}
                              className={cn(
                                'text-xs font-bold flex items-center gap-1 transition-opacity',
                                addingAllFromKey === String(storeSlug)
                                  ? 'text-amber-500 opacity-70'
                                  : 'text-amber-600 hover:text-amber-700'
                              )}
                            >
                              {addingAllFromKey === String(storeSlug) ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <ShoppingCart className="size-3.5" />
                              )}
                              {addingAllFromKey === String(storeSlug) ? t('Adding…', 'جاري الإضافة…') : `${t('Add all from', 'أضف الكل من')} ${(lang === 'ar' && storeProds[0]?.businessName_ar ? storeProds[0].businessName_ar : storeProds[0]?.businessName) ?? ''}`}
                            </motion.button>
                          )}
                          {storeProds.slice(0, 12).map((p) => {
                          const title = lang === 'ar' ? (p.title_ar ?? p.title_en) : (p.title_en ?? p.title_ar)
                          const businessDisplayName = lang === 'ar' && p.businessName_ar ? p.businessName_ar : p.businessName
                          const isDifferentStore = items.length > 0 && cartTenant?.slug && p.businessSlug && cartTenant.slug !== p.businessSlug
                          return (
                            <div
                              key={p._id}
                              className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200"
                            >
                              <div className="flex min-w-0 flex-1 items-center gap-3">
                                <div className="relative size-14 shrink-0 rounded-lg overflow-hidden bg-slate-100">
                                  {p.imageUrl ? (
                                    <Image
                                      src={p.imageUrl}
                                      alt={title ?? ''}
                                      fill
                                      className="object-cover"
                                      sizes="56px"
                                      placeholder="blur"
                                      blurDataURL={SHIMMER_PLACEHOLDER}
                                    />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center">
                                      <Store className="size-6 text-slate-400" />
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="font-semibold text-slate-900 truncate">{title}</p>
                                  <p className="text-xs text-slate-500 flex items-center gap-1.5" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                                    {businessDisplayName}
                                    {isDifferentStore && (
                                      <span className="inline-flex items-center rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">
                                        {t('Different store', 'متجر آخر')}
                                      </span>
                                    )}
                                    {p.businessOpenNow && !isDifferentStore && (
                                      <span className="inline-flex items-center rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                                        {t('Open', 'مفتوح')}
                                      </span>
                                    )}
                                  </p>
                                  {p.price > 0 && (
                                    <p className="text-sm font-bold text-slate-700 mt-0.5">
                                      {p.price} {p.currency}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex shrink-0 gap-2 flex-wrap">
                                <a
                                  href={`/t/${p.businessSlug}#product-${p._id}`}
                                  className="text-xs font-medium text-amber-600 hover:text-amber-700"
                                >
                                  {t('View menu', 'عرض القائمة')}
                                </a>
                                <motion.button
                                  type="button"
                                  onClick={() => handleAddToCart(p)}
                                  disabled={addingProductId === p._id}
                                  title={isDifferentStore ? t('Cart has items from another restaurant. Tap to choose: replace cart or go back.', 'سلتك تحتوي على أصناف من مطعم آخر. اضغط لاختيار: استبدال السلة أو العودة.') : undefined}
                                  whileTap={addingProductId !== p._id ? { scale: 0.95 } : undefined}
                                  className={cn(
                                    'inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors',
                                    addedProductId === p._id
                                      ? 'bg-emerald-500 text-white'
                                      : isDifferentStore
                                        ? 'bg-amber-200 text-amber-950 border-2 border-amber-500 hover:bg-amber-300'
                                        : 'text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-70'
                                  )}
                                >
                                  {addingProductId === p._id ? (
                                    <Loader2 className="size-3 animate-spin" />
                                  ) : addedProductId === p._id ? (
                                    <Check className="size-3" />
                                  ) : (
                                    <ShoppingCart className="size-3" />
                                  )}
                                  {addingProductId === p._id ? t('Adding…', 'جاري الإضافة…') : addedProductId === p._id ? t('Added', 'تمت الإضافة') : t('Add', 'أضف')}
                                </motion.button>
                              </div>
                            </div>
                          )
                        })}
                        </div>
                      ))}
                      {!hasByStore && displayProducts.length === 0 && (
                        <p className="text-xs text-slate-500">{t('No products found.', 'لم يتم العثور على منتجات.')}</p>
                      )}
                      {displayProducts.length > 12 && (
                        <p className="text-xs text-slate-500">
                          {t(`+ ${displayProducts.length - 12} more`, `+ ${displayProducts.length - 12} المزيد`)}
                        </p>
                      )}
                    </div>
                  )
                }
                if (part.type === 'tool-get_business_hours') {
                  if (part.state !== 'output-available' || !part.output) return null
                  const data = part.output as { found?: boolean; name?: string; isOpenNow?: boolean; todayHours?: string; fullWeekHours?: string }
                  if (!data.found) return null
                  return (
                    <div key={idx} className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-sm font-medium text-slate-800">
                        {data.name} — {data.isOpenNow ? t('Open now', 'مفتوح الآن') : t('Closed', 'مغلق')}
                      </p>
                      {data.todayHours && (
                        <p className="mt-1 text-xs text-slate-600">{t("Today's hours:", "ساعات اليوم:")} {data.todayHours}</p>
                      )}
                      {data.fullWeekHours && (
                        <p className="mt-1 text-xs text-slate-500">{data.fullWeekHours}</p>
                      )}
                    </div>
                  )
                }
                if (part.type === 'tool-show_store_choice') {
                  if (part.state !== 'output-available' || !part.output) return null
                  const hasIngredientStoreOptions = (message.parts ?? []).some((p) => {
                    if ((p as { type?: string }).type !== 'tool-search_ingredients') return false
                    const out = (p as { output?: { storeOptions?: unknown[] } }).output
                    return (out?.storeOptions?.length ?? 0) >= 2
                  })
                  if (hasIngredientStoreOptions) return null
                  const data = part.output as { type?: string; stores?: StoreOption[] }
                  const stores = data.stores ?? []
                  if (stores.length < 2) return null
                  const ingPart = (message.parts ?? []).find(
                    (p: { type?: string }) => p.type === 'tool-search_ingredients'
                  ) as { output?: { soughtIngredients?: string[] } } | undefined
                  const soughtIngredients = ingPart?.output?.soughtIngredients ?? []
                  const partKey = `${message.id}-store-choice-${idx}`
                  const chosenResult = storeChoiceResults[partKey]

                  if (chosenResult) {
                    const products = chosenResult.products
                    const byStore = chosenResult.byStore
                    const missing = chosenResult.missingIngredients ?? []
                    if (products.length === 0) {
                      return (
                        <div key={idx} className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                          <p className="text-sm font-medium text-amber-800">
                            {t('No matching ingredients in this store.', 'لا توجد مكونات مطابقة في هذا المتجر.')}
                          </p>
                        </div>
                      )
                    }
                    return (
                      <div key={idx} className="space-y-2 mt-3">
                        {missing.length > 0 && (
                          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2">
                            <p className="text-xs font-medium text-amber-800">{missing.join(', ')}</p>
                          </div>
                        )}
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                          {t('Ingredients from chosen store', 'المكونات من المتجر المختار')}
                        </p>
                        {Object.entries(byStore).map(([storeSlug, storeProds]) => (
                          <div key={storeSlug} className="space-y-2">
                            {storeProds.slice(0, 12).map((p) => {
                              const title = lang === 'ar' ? (p.title_ar ?? p.title_en) : (p.title_en ?? p.title_ar)
                              const businessDisplayName = lang === 'ar' && p.businessName_ar ? p.businessName_ar : p.businessName
                              const isDifferentStore = items.length > 0 && cartTenant?.slug && p.businessSlug && cartTenant.slug !== p.businessSlug
                              return (
                                <div
                                  key={p._id}
                                  className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200"
                                >
                                  <div className="flex min-w-0 flex-1 items-center gap-3">
                                    <div className="relative size-14 shrink-0 rounded-lg overflow-hidden bg-slate-100">
                                      {p.imageUrl ? (
                                        <Image src={p.imageUrl} alt={title ?? ''} fill className="object-cover" sizes="56px" placeholder="blur" blurDataURL={SHIMMER_PLACEHOLDER} />
                                      ) : (
                                        <div className="flex h-full w-full items-center justify-center">
                                          <Store className="size-6 text-slate-400" />
                                        </div>
                                      )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="font-semibold text-slate-900 truncate">{title}</p>
                                      <p className="text-xs text-slate-500">{businessDisplayName}</p>
                                      {p.price > 0 && <p className="text-sm font-bold text-slate-700">{p.price} {p.currency}</p>}
                                    </div>
                                  </div>
                                  <div className="flex shrink-0 gap-2">
                                    <a href={`/t/${p.businessSlug}#product-${p._id}`} className="text-xs font-medium text-amber-600 hover:text-amber-700">{t('View menu', 'عرض القائمة')}</a>
                                    <motion.button
                                      type="button"
                                      onClick={() => handleAddToCart(p)}
                                      disabled={addingProductId === p._id}
                                      whileTap={addingProductId !== p._id ? { scale: 0.95 } : undefined}
                                      className={cn(
                                        'inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg',
                                        addedProductId === p._id ? 'bg-emerald-500 text-white' : 'text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-70'
                                      )}
                                    >
                                      {addingProductId === p._id ? <Loader2 className="size-3 animate-spin" /> : addedProductId === p._id ? <Check className="size-3" /> : <ShoppingCart className="size-3" />}
                                      {addingProductId === p._id ? t('Adding…', 'جاري الإضافة…') : addedProductId === p._id ? t('Added', 'تمت الإضافة') : t('Add', 'أضف')}
                                    </motion.button>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        ))}
                      </div>
                    )
                  }

                  return (
                    <div key={idx} className="space-y-3 mt-3">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        {t('Ingredients are available in these stores. Pick one to see products:', 'المكونات متوفرة في هذه المتاجر. اختر متجراً لعرض المنتجات:')}
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        {stores.map((s) => {
                          const displayName = (lang === 'ar' && s.name_ar ? s.name_ar : s.name) || s.name
                          return (
                            <motion.button
                              key={s.slug}
                              type="button"
                              disabled={loadingStoreSlug !== null || soughtIngredients.length === 0}
                              whileTap={loadingStoreSlug === null ? { scale: 0.98 } : undefined}
                              onClick={async () => {
                                if (soughtIngredients.length === 0) return
                                setLoadingStoreSlug(s.slug)
                                try {
                                  ingredientsByStoreFetchRef.current?.abort()
                                  const fetchAc = new AbortController()
                                  ingredientsByStoreFetchRef.current = fetchAc
                                  const res = await fetch('/api/search/ingredients-by-store', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ ingredients: soughtIngredients, storeSlug: s.slug, city, country }),
                                    signal: fetchAc.signal,
                                  })
                                  if (res.ok) {
                                    const result = await res.json()
                                    setStoreChoiceResults((prev) => ({
                                      ...prev,
                                      [partKey]: {
                                        products: result.products ?? [],
                                        byStore: result.byStore ?? {},
                                        missingIngredients: result.missingIngredients ?? [],
                                      },
                                    }))
                                  }
                                } catch (e) {
                                  if ((e as Error)?.name === 'AbortError') return
                                  console.error('Store choice fetch:', e)
                                  showToast(t('Could not load products. Try again.', 'تعذر تحميل المنتجات. حاول مرة أخرى.'), '', 'error')
                                } finally {
                                  setLoadingStoreSlug(null)
                                }
                              }}
                              className="flex flex-col items-center p-4 rounded-xl border-2 bg-white border-slate-200 hover:border-amber-400 hover:shadow-md disabled:opacity-70"
                            >
                              {loadingStoreSlug === s.slug ? (
                                <Loader2 className="size-10 text-amber-500 animate-spin mb-2" />
                              ) : (
                                <Store className="size-10 text-amber-500 mb-2" />
                              )}
                              <span className="font-bold text-slate-900 text-sm line-clamp-2 text-center" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                                {displayName}
                              </span>
                              <span className="text-xs text-slate-500 mt-0.5">{s.productCount} {t('products', 'منتج')}</span>
                            </motion.button>
                          )
                        })}
                      </div>
                    </div>
                  )
                }
                if (part.type === 'tool-show_quick_reply_buttons') {
                  if (part.state !== 'output-available' || !part.output) return null
                  const data = part.output as { type?: string; options?: string[]; prompt?: string | null }
                  const rawOpts = data.options ?? (data.type === 'yes_no' ? ['Yes', 'No'] : [])
                  const opts = data.type === 'yes_no' && lang === 'ar' ? [t('Yes', 'نعم'), t('No', 'لا')] : rawOpts
                  if (opts.length === 0) return null
                  const prompt = data.prompt
                  const isNumericGrid = opts.length >= 6 && opts.every((o) => /^\d+$/.test(o.trim()))
                  return (
                    <div key={idx} className="mt-4 flex flex-col gap-3">
                      {prompt && (
                        <p className="text-sm font-medium text-slate-700" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                          {prompt}
                        </p>
                      )}
                      <div
                        className={cn(
                          'gap-2',
                          isNumericGrid ? 'grid grid-cols-5 sm:grid-cols-5' : 'flex flex-wrap'
                        )}
                      >
                        {opts.map((label) => (
                          <button
                            key={label}
                            type="button"
                            onClick={() => {
                              onSaveQuestion?.(label)
                              sendMessage({ text: label })
                            }}
                            className={cn(
                              'rounded-2xl px-4 py-3 text-sm font-semibold transition-all duration-200 ease-out',
                              'shadow-sm hover:shadow-md active:scale-[0.98]',
                              'border-2 border-amber-500/80 bg-amber-500 text-slate-950 hover:bg-amber-400 hover:border-amber-400',
                              isNumericGrid && 'px-3 py-2.5 min-w-[2.5rem]'
                            )}
                            dir={lang === 'ar' ? 'rtl' : 'ltr'}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                }
                if (part.type === 'tool-search_products') {
                  if (part.state !== 'output-available' || !part.output) return null
                  const data = part.output as { products?: ToolProduct[]; businesses?: ToolBusiness[] }
                  const products = data.products ?? []
                  const businesses = data.businesses ?? []
                  return (
                    <div key={idx} className="space-y-2 mt-3">
                      {businesses.length > 0 && (
                        <>
                          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                            {t('Stores', 'المتاجر')}
                          </p>
                          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {businesses.slice(0, 6).map((b) => {
                              const displayName = (lang === 'ar' && b.name_ar ? b.name_ar : b.name) || b.name
                              return (
                                <a
                                  key={b.slug}
                                  href={`/t/${b.slug}`}
                                  className="group flex flex-col items-center overflow-hidden rounded-[20px] bg-white p-4 pb-4 transition-all duration-300 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.12)] border border-transparent hover:border-amber-300/50"
                                >
                                  <div className="relative size-[64px] sm:size-[72px] shrink-0 overflow-hidden rounded-2xl bg-slate-50 shadow-sm border border-slate-100/60 group-hover:scale-[1.03] transition-transform duration-300 mb-2">
                                    {b.logoUrl ? (
                                      <Image
                                        src={b.logoUrl}
                                        alt={displayName}
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
                                  <h3 className="font-bold text-slate-900 text-[15px] sm:text-[17px] tracking-tight text-center line-clamp-2 w-full" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                                    {displayName}
                                  </h3>
                                  <p className="mt-0.5 text-[12px] text-slate-500 capitalize font-medium">
                                    {lang === 'ar'
                                      ? BUSINESS_TYPES.find((bt) => bt.value === b.businessType)?.labelAr ?? b.businessType
                                      : BUSINESS_TYPES.find((bt) => bt.value === b.businessType)?.label ?? b.businessType}
                                  </p>
                                </a>
                              )
                            })}
                          </div>
                        </>
                      )}
                      {products.length > 0 && (
                        <>
                          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-2">
                            {t('Products', 'المنتجات')}
                          </p>
                          <div className="grid gap-2">
                            {products.slice(0, 12).map((p) => {
                              const title = lang === 'ar' ? (p.title_ar ?? p.title_en) : (p.title_en ?? p.title_ar)
                              const businessDisplayName = lang === 'ar' && p.businessName_ar ? p.businessName_ar : p.businessName
                              const isDifferentStore = items.length > 0 && cartTenant?.slug && p.businessSlug && cartTenant.slug !== p.businessSlug
                              return (
                                <div
                                  key={p._id}
                                  className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200"
                                >
                                  <a
                                    href={`/t/${p.businessSlug}#product-${p._id}`}
                                    className="flex min-w-0 flex-1 items-center gap-3"
                                  >
                                    <div className="relative size-14 shrink-0 rounded-lg overflow-hidden bg-slate-100 flex items-center justify-center">
                                      {p.imageUrl ? (
                                        <Image src={p.imageUrl} alt={title ?? ''} fill className="object-cover" sizes="56px" />
                                      ) : (
                                        <Store className="size-5 text-slate-400" />
                                      )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="font-semibold text-slate-900 truncate">{title}</p>
                                      <p className="text-xs text-slate-500 flex items-center gap-1.5" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                                        {businessDisplayName}
                                        {isDifferentStore && (
                                          <span className="inline-flex items-center rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">
                                            {t('Different store', 'متجر آخر')}
                                          </span>
                                        )}
                                        {p.businessOpenNow && !isDifferentStore && (
                                          <span className="inline-flex items-center rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                                            {t('Open', 'مفتوح')}
                                          </span>
                                        )}
                                      </p>
                                      {p.price > 0 && (
                                        <p className="text-sm font-bold text-slate-700 mt-0.5">
                                          {p.price} {p.currency}
                                        </p>
                                      )}
                                    </div>
                                  </a>
                                  <div className="flex shrink-0 gap-2 flex-wrap">
                                    <a
                                      href={`/t/${p.businessSlug}#product-${p._id}`}
                                      className="text-xs font-medium text-amber-600 hover:text-amber-700"
                                    >
                                      {t('View menu', 'عرض القائمة')}
                                    </a>
                                    <motion.button
                                      type="button"
                                      onClick={() => handleAddToCart(p)}
                                      disabled={addingProductId === p._id}
                                      title={isDifferentStore ? t('Cart has items from another restaurant. Tap to choose: replace cart or go back.', 'سلتك تحتوي على أصناف من مطعم آخر. اضغط لاختيار: استبدال السلة أو العودة.') : undefined}
                                      whileTap={addingProductId !== p._id ? { scale: 0.95 } : undefined}
                                      className={cn(
                                        'inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors',
                                        addedProductId === p._id
                                          ? 'bg-emerald-500 text-white'
                                          : isDifferentStore
                                            ? 'bg-amber-200 text-amber-950 border-2 border-amber-500 hover:bg-amber-300'
                                            : 'text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-70'
                                      )}
                                    >
                                      {addingProductId === p._id ? (
                                        <Loader2 className="size-3 animate-spin" />
                                      ) : addedProductId === p._id ? (
                                        <Check className="size-3" />
                                      ) : (
                                        <ShoppingCart className="size-3" />
                                      )}
                                      {addingProductId === p._id ? t('Adding…', 'جاري الإضافة…') : addedProductId === p._id ? t('Added', 'تمت الإضافة') : t('Add', 'أضف')}
                                    </motion.button>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  )
                }
                return null
              })}
            </div>
          )
        })}
      </div>

      {/* Dedicated reply input — always visible so user can type follow-ups */}
      <form
        onSubmit={handleSendReply}
        className="sticky bottom-0 flex gap-2 border-t border-slate-200 bg-white pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] px-4"
      >
        <input
          ref={replyInputRef}
          type="text"
          value={replyInput}
          onChange={(e) => setReplyInput(e.target.value)}
          placeholder={t('Type your reply...', 'اكتب ردك...')}
          disabled={loading}
          className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50 disabled:opacity-60"
          dir={lang === 'ar' ? 'rtl' : 'ltr'}
        />
        <button
          type="submit"
          disabled={loading || !replyInput.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-slate-950 transition-colors hover:bg-amber-400 disabled:opacity-50 disabled:hover:bg-amber-500"
          aria-label={t('Send', 'إرسال')}
        >
          <Send className="size-5" />
        </button>
      </form>
    </div>
  )
}
