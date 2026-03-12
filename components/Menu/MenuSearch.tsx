'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { Product, MenuData } from '@/app/types/menu'
import { useLanguage } from '@/components/LanguageContext'
import { Input } from '@/components/ui/input'
import { Search, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import { urlFor } from '@/sanity/lib/image'
import { SHIMMER_PLACEHOLDER } from '@/lib/image-placeholder'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency'
import { fuzzySearch, suggestCorrection, type SearchableItem } from '@/lib/search/fuzzy-suggest'

interface MenuSearchProps {
  categories: MenuData[]
  popularProducts: Product[]
  onProductClick: (product: Product) => void
  restaurantLogo?: any
}

export function MenuSearch({ categories, popularProducts, onProductClick, restaurantLogo }: MenuSearchProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const searchRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const { t, lang } = useLanguage()

  // Get all products from categories and popular products
  const uniqueProducts = useMemo(() => {
    const all: Product[] = [...popularProducts, ...categories.flatMap((c) => c.products)]
    return all.filter((p, i, self) => self.findIndex((x) => x._id === p._id) === i)
  }, [popularProducts, categories])

  // Fuzzy search with typo tolerance (Arabic + English)
  const { filteredProducts, didYouMean } = useMemo(() => {
    const q = searchQuery.trim()
    if (!q) return { filteredProducts: [], didYouMean: null as string | null }
    const searchable: SearchableItem[] = uniqueProducts.map((p) => ({
      id: p._id,
      text: [p.title_en, p.title_ar].filter(Boolean).join(' '),
      textSecondary: [p.description_en, p.description_ar].filter(Boolean).join(' ') || undefined,
    }))
    const matched = fuzzySearch(q, searchable, { threshold: 0.45, limit: 50 })
    const ids = new Set(matched.map((m) => m.id))
    const filtered = uniqueProducts.filter((p) => ids.has(p._id))
    const suggestion = filtered.length === 0 && searchable.length > 0 ? suggestCorrection(q, searchable, { threshold: 0.5 }) : null
    return { filteredProducts: filtered, didYouMean: suggestion }
  }, [searchQuery, uniqueProducts])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setFocusedIndex(-1)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen || filteredProducts.length === 0) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setFocusedIndex(prev =>
          prev < filteredProducts.length - 1 ? prev + 1 : prev
        )
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setFocusedIndex(prev => prev > 0 ? prev - 1 : -1)
      } else if (e.key === 'Enter' && focusedIndex >= 0) {
        e.preventDefault()
        handleProductSelect(filteredProducts[focusedIndex])
      } else if (e.key === 'Escape') {
        setIsOpen(false)
        setFocusedIndex(-1)
        inputRef.current?.blur()
      }
    }

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, filteredProducts, focusedIndex])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchQuery(value)
    setIsOpen(value.trim().length > 0)
    setFocusedIndex(-1)
  }

  const handleProductSelect = (product: Product) => {
    onProductClick(product)
    setSearchQuery('')
    setIsOpen(false)
    setFocusedIndex(-1)
    inputRef.current?.blur()
  }

  const handleClear = () => {
    setSearchQuery('')
    setIsOpen(false)
    setFocusedIndex(-1)
    inputRef.current?.focus()
  }

  return (
    <div ref={searchRef} className="relative w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={handleInputChange}
          onFocus={() => {
            if (searchQuery.trim()) {
              setIsOpen(true)
            }
          }}
          placeholder={t('Search menu...', 'ابحث في القائمة...')}
          className="pl-9 pr-9 h-10 w-full rounded-full border-slate-200 bg-white focus:border-black focus:ring-2 focus:ring-black/10 text-sm"
        />
        {searchQuery && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Search Results Dropdown */}
      <AnimatePresence>
        {isOpen && filteredProducts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-200 max-h-[400px] overflow-y-auto z-50"
          >
            <div className="p-2">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider px-3 py-2">
                {t('Search Results', 'نتائج البحث')} ({filteredProducts.length})
              </div>
              {filteredProducts.map((product, index) => {
                const hasSpecialPrice =
                  product.specialPrice &&
                  (!product.specialPriceExpires ||
                    new Date(product.specialPriceExpires) > new Date())
                const price = hasSpecialPrice ? product.specialPrice! : product.price
                const displayImage = product.image || restaurantLogo

                return (
                  <button
                    key={product._id}
                    onClick={() => handleProductSelect(product)}
                    onMouseEnter={() => setFocusedIndex(index)}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-xl transition-colors text-left",
                      focusedIndex === index
                        ? "bg-slate-100"
                        : "hover:bg-slate-50"
                    )}
                  >
                    {displayImage && (
                      <div className="relative w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-slate-100">
                        <Image
                          src={urlFor(displayImage).width(128).height(128).url()}
                          alt={lang === 'ar' ? product.title_ar : product.title_en}
                          fill
                          sizes="64px"
                          placeholder="blur"
                          blurDataURL={SHIMMER_PLACEHOLDER}
                          className={cn(
                            product.image ? "object-cover" : "object-contain p-2"
                          )}
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-sm mb-1 line-clamp-1">
                        {lang === 'ar' ? product.title_ar : product.title_en}
                      </h4>
                      <p className="text-xs text-slate-500 line-clamp-1 mb-1">
                        {lang === 'ar'
                          ? product.description_ar || product.description_en || ''
                          : product.description_en || product.description_ar || ''
                        }
                      </p>
                      <div className="flex items-center gap-2">
                        {hasSpecialPrice && (
                          <span className="text-xs text-slate-400 line-through">
                            {product.price}
                          </span>
                        )}
                        <span className={cn(
                          "text-base font-black",
                          hasSpecialPrice ? "text-red-600" : "text-slate-900"
                        )}>
                          {price} {formatCurrency(product.currency)}
                        </span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </motion.div>
        )}

        {isOpen && searchQuery.trim() && filteredProducts.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 text-center z-50"
          >
            {didYouMean ? (
              <>
                <p className="text-slate-600 font-medium">
                  {t('Did you mean', 'هل تقصد')}{' '}
                  <button
                    type="button"
                    onClick={() => { setSearchQuery(didYouMean!); setFocusedIndex(-1) }}
                    className="text-brand-yellow font-bold underline underline-offset-2 hover:text-amber-600"
                  >
                    {didYouMean}
                  </button>
                  ?
                </p>
              </>
            ) : (
              <>
                <p className="text-slate-500 font-medium">
                  {t('No results found', 'لم يتم العثور على نتائج')}
                </p>
                <p className="text-sm text-slate-400 mt-1">
                  {t('Try a different search term', 'جرب مصطلح بحث مختلف')}
                </p>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
