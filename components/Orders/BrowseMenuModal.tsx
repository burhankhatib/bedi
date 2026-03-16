'use client'

import { useEffect, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { LayoutGrid, Search, X, Package, Plus } from 'lucide-react'
import { useLanguage } from '@/components/LanguageContext'
import { formatCurrency } from '@/lib/currency'
import { cn } from '@/lib/utils'

export type ProductRow = {
  _id: string
  productId: string
  title_en: string
  title_ar: string
  price: number
  currency: string
  imageUrl: string
  selectedVariants?: number[]
}

type CategorySection = {
  _id: string
  title_en: string
  title_ar: string
  products: ProductRow[]
}

interface BrowseMenuModalProps {
  open: boolean
  onClose: () => void
  fetchUrl: string
  onSelect: (row: ProductRow) => void
  currency?: string
  /** Customer (light) vs Driver (dark) theme */
  variant?: 'customer' | 'driver'
}

export function BrowseMenuModal({
  open,
  onClose,
  fetchUrl,
  onSelect,
  currency = 'ILS',
  variant = 'customer',
}: BrowseMenuModalProps) {
  const { lang } = useLanguage()
  const [categories, setCategories] = useState<CategorySection[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const isDriver = variant === 'driver'

  useEffect(() => {
    if (!open || !fetchUrl) return
    setLoading(true)
    setError(null)
    setCategories([])
    fetch(fetchUrl, { cache: 'no-store' })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load menu')
        return res.json()
      })
      .then((data) => {
        setCategories(data.categories ?? [])
      })
      .catch(() => {
        setError('Could not load menu')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [open, fetchUrl])

  const filteredCategories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return categories
    return categories
      .map((cat) => ({
        ...cat,
        products: cat.products.filter(
          (p) =>
            (p.title_en ?? '').toLowerCase().includes(q) ||
            (p.title_ar ?? '').toLowerCase().includes(q)
        ),
      }))
      .filter((cat) => cat.products.length > 0)
  }, [categories, searchQuery])

  const fmtCurrency = formatCurrency(currency)

  if (!open) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[600] flex flex-col items-center justify-end sm:justify-center p-0 sm:p-4"
      >
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
          aria-hidden
        />
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className={cn(
            'relative w-full max-w-lg max-h-[90vh] rounded-t-3xl sm:rounded-3xl flex flex-col overflow-hidden shadow-2xl',
            isDriver ? 'bg-slate-900' : 'bg-white'
          )}
        >
          <div
            className={cn(
              'flex items-center justify-between px-4 py-3 border-b shrink-0',
              isDriver ? 'border-slate-700 bg-slate-800/80' : 'border-slate-200 bg-slate-50'
            )}
          >
            <div className="flex items-center gap-2">
              <LayoutGrid className={cn('size-5', isDriver ? 'text-emerald-400' : 'text-indigo-600')} />
              <h2 className={cn('text-lg font-bold', isDriver ? 'text-white' : 'text-slate-900')}>
                {lang === 'ar' ? 'عرض القائمة' : 'Browse Menu'}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className={cn(
                'size-10 rounded-full flex items-center justify-center transition-colors',
                isDriver ? 'bg-slate-700 hover:bg-slate-600 text-slate-300' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
              )}
              aria-label={lang === 'ar' ? 'إغلاق' : 'Close'}
            >
              <X className="size-5" />
            </button>
          </div>

          <div className="flex items-center gap-2 px-4 py-3 border-b shrink-0" style={{ borderColor: isDriver ? 'rgb(51 65 85)' : 'rgb(226 232 240)' }}>
            <Search className={cn('size-5 shrink-0', isDriver ? 'text-slate-400' : 'text-slate-500')} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={lang === 'ar' ? 'ابحث في القائمة...' : 'Search menu...'}
              className={cn(
                'flex-1 min-h-[44px] rounded-xl px-4 text-base outline-none placeholder:opacity-70',
                isDriver
                  ? 'bg-slate-800 text-slate-100 placeholder:text-slate-500 border border-slate-600'
                  : 'bg-white text-slate-900 placeholder:text-slate-400 border border-slate-200'
              )}
            />
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            {loading && (
              <div className={cn('flex items-center justify-center py-16', isDriver ? 'text-slate-400' : 'text-slate-500')}>
                <div className="animate-spin size-8 border-2 border-current border-t-transparent rounded-full" />
              </div>
            )}
            {error && (
              <p className={cn('text-center py-8', isDriver ? 'text-rose-400' : 'text-rose-600')}>
                {error}
              </p>
            )}
            {!loading && !error && filteredCategories.length === 0 && (
              <p className={cn('text-center py-8', isDriver ? 'text-slate-400' : 'text-slate-500')}>
                {lang === 'ar' ? 'لا توجد أصناف.' : 'No products found.'}
              </p>
            )}
            {!loading && !error && filteredCategories.length > 0 && (
              <div className="space-y-6">
                {filteredCategories.map((cat) => (
                  <div key={cat._id}>
                    <h3
                      className={cn(
                        'text-xs font-bold uppercase tracking-wider mb-2',
                        isDriver ? 'text-emerald-400' : 'text-indigo-600'
                      )}
                    >
                      {lang === 'ar' ? cat.title_ar : cat.title_en}
                    </h3>
                    <div className="space-y-2">
                      {cat.products.map((p) => {
                        const name = lang === 'ar' ? p.title_ar : p.title_en
                        return (
                          <motion.button
                            key={p._id}
                            type="button"
                            onClick={() => {
                              onSelect(p)
                              onClose()
                            }}
                            whileTap={{ scale: 0.98 }}
                            className={cn(
                              'w-full flex items-center gap-4 p-3 rounded-2xl border-2 text-left transition-colors',
                              isDriver
                                ? 'border-slate-700 bg-slate-800/80 hover:border-emerald-500/50 hover:bg-slate-800'
                                : 'border-slate-200 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50/50'
                            )}
                          >
                            <div className="shrink-0 w-16 h-16 rounded-xl overflow-hidden bg-slate-200 flex items-center justify-center">
                              {p.imageUrl ? (
                                <img
                                  src={p.imageUrl}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Package className={cn('size-7', isDriver ? 'text-slate-500' : 'text-slate-400')} />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className={cn('font-bold truncate', isDriver ? 'text-slate-100' : 'text-slate-900')}>
                                {name}
                              </p>
                              <p className={cn('font-bold text-sm mt-0.5', isDriver ? 'text-emerald-400' : 'text-indigo-600')}>
                                {p.price.toFixed(2)} {fmtCurrency}
                              </p>
                            </div>
                            <Plus className={cn('size-5 shrink-0', isDriver ? 'text-emerald-400' : 'text-indigo-600')} />
                          </motion.button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
