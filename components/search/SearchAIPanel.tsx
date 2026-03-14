'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { Loader2, Sparkles, Store, ShoppingCart, Send } from 'lucide-react'
import { useLanguage } from '@/components/LanguageContext'
import { useCart } from '@/components/Cart/CartContext'
import { cn } from '@/lib/utils'
import { SHIMMER_PLACEHOLDER } from '@/lib/image-placeholder'
import { SanitizedMarkdown } from '@/components/ai/SanitizedMarkdown'
import type { Product } from '@/app/types/menu'
import type { ToolProduct } from '@/lib/ai/search-tools'

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
}: SearchAIPanelProps) {
  const { lang } = useLanguage()
  const { addToCart } = useCart()
  const containerRef = useRef<HTMLDivElement>(null)
  const [replyInput, setReplyInput] = useState('')
  const replyInputRef = useRef<HTMLInputElement>(null)

  const { messages, sendMessage, status } = useChat({
    id: `search-ai-${city}`,
    transport: new DefaultChatTransport({
      api: '/api/search/chat',
      body: { city, country, lang: lang === 'ar' ? 'ar' : 'en' },
    }),
  })

  const lastSentKey = useRef('')
  useEffect(() => {
    if (!query.trim() || !city) return
    const key = `initial:${city}:${query}`
    if (lastSentKey.current === key) return
    lastSentKey.current = key
    sendMessage({ text: query })
  }, [query, city, sendMessage])

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
    try {
      const res = await fetch(`/api/search/product/${p._id}`)
      if (!res.ok) throw new Error('Failed to fetch product')
      const { product, tenant } = await res.json()
      if (!product || !tenant?.slug) throw new Error('Invalid product data')
      addToCart(product as Product, [], [], {
        slug: tenant.slug,
        name: tenant.name,
      })
    } catch (e) {
      console.error('Add to cart:', e)
    }
  }

  return (
    <div className={cn('flex flex-col', className)}>
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 bg-slate-50/80">
        <Sparkles className="size-4 text-amber-500" />
        <span className="text-sm font-medium text-slate-700">
          {t('AI assistant', 'المساعد الذكي')}
        </span>
      </div>

      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto max-h-[320px] px-4 py-4 min-h-[120px]"
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
                  const data = part.output as { products?: ToolProduct[]; byStore?: Record<string, ToolProduct[]>; soughtIngredients?: string[] }
                  const products = data.products ?? Object.values(data.byStore ?? {}).flat()
                  if (products.length === 0) {
                    const sought = data.soughtIngredients ?? []
                    return (
                      <div key={idx} className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                        <p className="text-sm font-medium text-amber-800">
                          {t('No matching ingredients found in our stores.', 'لم يتم العثور على هذه المكونات في متاجرنا.')}
                        </p>
                        {sought.length > 0 && (
                          <p className="mt-1 text-xs text-amber-700">
                            {t('Searched for:', 'تم البحث عن:')} {sought.join(', ')}
                          </p>
                        )}
                      </div>
                    )
                  }
                  return (
                    <div key={idx} className="space-y-2 mt-3">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        {t('Ingredients found', 'المكونات المتوفرة')}
                      </p>
                      <div className="grid gap-2">
                        {products.slice(0, 12).map((p) => {
                          const title = lang === 'ar' ? (p.title_ar ?? p.title_en) : (p.title_en ?? p.title_ar)
                          return (
                            <div
                              key={p._id}
                              className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200"
                            >
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
                                <p className="text-xs text-slate-500">{p.businessName}</p>
                                {p.price > 0 && (
                                  <p className="text-sm font-bold text-slate-700 mt-0.5">
                                    {p.price} {p.currency}
                                  </p>
                                )}
                              </div>
                              <div className="flex flex-col gap-1 shrink-0">
                                <Link
                                  href={`/t/${p.businessSlug}#product-${p._id}`}
                                  className="text-xs font-medium text-amber-600 hover:text-amber-700"
                                  onClick={onClose}
                                >
                                  {t('View menu', 'عرض القائمة')}
                                </Link>
                                <button
                                  type="button"
                                  onClick={() => handleAddToCart(p)}
                                  className="inline-flex items-center gap-1 text-xs font-medium text-white bg-amber-500 hover:bg-amber-600 px-2 py-1 rounded-lg"
                                >
                                  <ShoppingCart className="size-3" />
                                  {t('Add', 'أضف')}
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      {products.length > 12 && (
                        <p className="text-xs text-slate-500">
                          {t(`+ ${products.length - 12} more`, `+ ${products.length - 12} المزيد`)}
                        </p>
                      )}
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
                  return (
                    <div key={idx} className="mt-3 flex flex-col gap-2">
                      {prompt && (
                        <p className="text-sm text-slate-600" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                          {prompt}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {opts.map((label) => (
                          <button
                            key={label}
                            type="button"
                            onClick={() => {
                              const isAffirmative = /^(yes|no|yeah|نعم|لا)$/i.test(label.trim())
                              if (!isAffirmative) onSaveQuestion?.(label)
                              sendMessage({ text: label })
                            }}
                            className="rounded-xl border-2 border-amber-400 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 transition-colors hover:bg-amber-100 active:scale-[0.98]"
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
                  const data = part.output as { products?: ToolProduct[]; businesses?: Array<{ name: string; slug: string }> }
                  const products = data.products ?? []
                  const businesses = data.businesses ?? []
                  return (
                    <div key={idx} className="space-y-2 mt-3">
                      {businesses.length > 0 && (
                        <>
                          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                            {t('Stores', 'المتاجر')}
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {businesses.slice(0, 6).map((b) => (
                              <Link
                                key={b.slug}
                                href={`/t/${b.slug}`}
                                className="text-xs font-medium text-amber-600 hover:text-amber-700"
                                onClick={onClose}
                              >
                                {b.name}
                              </Link>
                            ))}
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
                              return (
                                <div
                                  key={p._id}
                                  className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200"
                                >
                                  <Link
                                    href={`/t/${p.businessSlug}#product-${p._id}`}
                                    onClick={onClose}
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
                                      <p className="text-xs text-slate-500">{p.businessName}</p>
                                      {p.price > 0 && (
                                        <p className="text-sm font-bold text-slate-700 mt-0.5">
                                          {p.price} {p.currency}
                                        </p>
                                      )}
                                    </div>
                                  </Link>
                                  <div className="flex flex-col gap-1 shrink-0">
                                    <Link
                                      href={`/t/${p.businessSlug}#product-${p._id}`}
                                      className="text-xs font-medium text-amber-600 hover:text-amber-700"
                                      onClick={onClose}
                                    >
                                      {t('View menu', 'عرض القائمة')}
                                    </Link>
                                    <button
                                      type="button"
                                      onClick={() => handleAddToCart(p)}
                                      className="inline-flex items-center gap-1 text-xs font-medium text-white bg-amber-500 hover:bg-amber-600 px-2 py-1 rounded-lg"
                                    >
                                      <ShoppingCart className="size-3" />
                                      {t('Add', 'أضف')}
                                    </button>
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
        className="sticky bottom-0 flex gap-2 border-t border-slate-200 bg-white p-3"
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
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white transition-colors hover:bg-amber-600 disabled:opacity-50 disabled:hover:bg-amber-500"
          aria-label={t('Send', 'إرسال')}
        >
          <Send className="size-5" />
        </button>
      </form>
    </div>
  )
}
