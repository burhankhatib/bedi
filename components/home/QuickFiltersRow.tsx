'use client'

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { useLanguage } from '@/components/LanguageContext'
import { ChevronDown, RotateCcw, Tag, Star, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface HomePageFilters {
  deliveryFee: 'all' | 'free' | 'under10'
  dealOnly: boolean
  minRating: number | null
  fastest: boolean
}

export const DEFAULT_HOME_FILTERS: HomePageFilters = {
  deliveryFee: 'all',
  dealOnly: false,
  minRating: null,
  fastest: false,
}

export function hasActiveHomeFilters(f: HomePageFilters): boolean {
  return (
    f.deliveryFee !== DEFAULT_HOME_FILTERS.deliveryFee ||
    f.dealOnly !== DEFAULT_HOME_FILTERS.dealOnly ||
    f.minRating !== DEFAULT_HOME_FILTERS.minRating ||
    f.fastest !== DEFAULT_HOME_FILTERS.fastest
  )
}

interface QuickFiltersRowProps {
  filters: HomePageFilters
  onChange: (filters: HomePageFilters) => void
}

type DropdownItem = {
  value: string
  label: string
}

function HomeFilterDropdown({
  label,
  valueLabel,
  active,
  selectedValue,
  items,
  onSelect,
  icon,
  isRtl,
}: {
  label: string
  valueLabel: string
  active: boolean
  selectedValue: string
  items: DropdownItem[]
  onSelect: (value: string) => void
  icon?: ReactNode
  isRtl: boolean
}) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 220 })
  const listId = useId()

  useEffect(() => {
    setMounted(true)
  }, [])

  const updatePosition = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const menuWidth = Math.min(Math.max(220, rect.width), typeof window !== 'undefined' ? window.innerWidth - 16 : 280)
    let left = isRtl ? rect.right - menuWidth : rect.left
    if (typeof window !== 'undefined') {
      left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8))
    }
    const top = rect.bottom + 6
    setCoords({ top, left, width: menuWidth })
  }, [isRtl])

  useLayoutEffect(() => {
    if (!open) return
    updatePosition()
    const onScroll = () => updatePosition()
    const onResize = () => updatePosition()
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
    }
  }, [open, updatePosition])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (triggerRef.current?.contains(t)) return
      if (menuRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const handleSelect = useCallback(
    (value: string) => {
      onSelect(value)
      setOpen(false)
    },
    [onSelect]
  )

  return (
    <div className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors duration-200',
          active
            ? 'border-brand-yellow bg-brand-yellow/10 text-brand-black dark:text-brand-yellow'
            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
        )}
      >
        {icon}
        <span className="max-w-[140px] truncate sm:max-w-[180px]">{valueLabel}</span>
        <ChevronDown className={cn('size-3.5 shrink-0 opacity-70 transition-transform', open && 'rotate-180')} />
      </button>
      {mounted &&
        open &&
        createPortal(
          <div
            ref={menuRef}
            id={listId}
            role="listbox"
            aria-label={label}
            className="fixed z-[100] max-h-[min(50vh,280px)] overflow-hidden rounded-2xl border border-slate-200/90 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-900"
            style={{
              top: coords.top,
              left: coords.left,
              width: coords.width,
            }}
          >
            <div className="border-b border-slate-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
              {label}
            </div>
            <ul className="max-h-[min(45vh,240px)] overflow-y-auto py-1">
              {items.map((item) => (
                <li key={item.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={item.value === selectedValue}
                    className="flex w-full items-center px-3 py-2.5 text-start text-[13px] font-medium text-slate-800 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800"
                    onClick={() => handleSelect(item.value)}
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>,
          document.body
        )}
    </div>
  )
}

export function QuickFiltersRow({ filters, onChange }: QuickFiltersRowProps) {
  const { t, lang } = useLanguage()
  const isRtl = lang === 'ar'

  const deliveryItems: DropdownItem[] = [
    { value: 'all', label: t('Show all', 'عرض الكل') },
    { value: 'free', label: t('Free delivery', 'توصيل مجاني') },
    { value: 'under10', label: t('Delivery under ₪10', 'توصيل أقل من 10₪') },
  ]

  const ratingItems: DropdownItem[] = [
    { value: 'any', label: t('Any rating', 'أي تقييم') },
    { value: '4', label: t('Over 4.0', 'أعلى من 4.0') },
    { value: '4.5', label: t('Over 4.5', 'أعلى من 4.5') },
    { value: '4.8', label: t('Over 4.8', 'أعلى من 4.8') },
    { value: '5', label: t('5.0 only', '5.0 فقط') },
  ]

  const dealItems: DropdownItem[] = [
    { value: 'all', label: t('All stores', 'كل المتاجر') },
    { value: 'deals', label: t('Special prices only', 'عروض وأسعار خاصة فقط') },
  ]

  const fastestItems: DropdownItem[] = [
    { value: 'default', label: t('Default order', 'الترتيب الافتراضي') },
    { value: 'fastest', label: t('Fastest estimated time', 'أسرع وقت تقديري') },
  ]

  const deliveryLabel =
    filters.deliveryFee === 'all'
      ? t('All fees', 'كل الرسوم')
      : filters.deliveryFee === 'free'
        ? t('Free delivery', 'توصيل مجاني')
        : t('Under ₪10', 'أقل من 10₪')

  const ratingLabel =
    filters.minRating === null
      ? t('Any rating', 'أي تقييم')
      : filters.minRating === 5
        ? t('5.0 only', '5.0 فقط')
        : t(`Over ${filters.minRating}`, `أعلى من ${filters.minRating}`)

  const dealLabel = filters.dealOnly ? t('Deals', 'عروض') : t('All stores', 'كل المتاجر')

  const fastestLabel = filters.fastest
    ? t('Fastest estimate', 'أسرع تقدير')
    : t('Sort', 'الترتيب')

  const ratingSelected =
    filters.minRating === null ? 'any' : filters.minRating === 5 ? '5' : String(filters.minRating)

  const showReset = hasActiveHomeFilters(filters)

  return (
    <div className="relative z-20 w-full border-b border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div
        className="relative z-20 mx-auto flex max-w-7xl items-center gap-2 px-4 py-2.5"
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto no-scrollbar">
          <HomeFilterDropdown
            label={t('Delivery fee', 'رسوم التوصيل')}
            valueLabel={deliveryLabel}
            active={filters.deliveryFee !== 'all'}
            selectedValue={filters.deliveryFee}
            items={deliveryItems}
            isRtl={isRtl}
            onSelect={(v) => onChange({ ...filters, deliveryFee: v as HomePageFilters['deliveryFee'] })}
          />

          <HomeFilterDropdown
            label={t('Deals', 'عروض')}
            valueLabel={dealLabel}
            active={filters.dealOnly}
            selectedValue={filters.dealOnly ? 'deals' : 'all'}
            items={dealItems}
            isRtl={isRtl}
            icon={<Tag className="size-3.5 text-emerald-600 dark:text-emerald-400" />}
            onSelect={(v) => onChange({ ...filters, dealOnly: v === 'deals' })}
          />

          <HomeFilterDropdown
            label={t('Rating', 'التقييم')}
            valueLabel={ratingLabel}
            active={filters.minRating !== null}
            selectedValue={ratingSelected}
            items={ratingItems}
            isRtl={isRtl}
            icon={<Star className="size-3.5 fill-amber-400 text-amber-400" />}
            onSelect={(v) => {
              if (v === 'any') onChange({ ...filters, minRating: null })
              else onChange({ ...filters, minRating: parseFloat(v) })
            }}
          />

          <HomeFilterDropdown
            label={t('Estimated arrival', 'الوصول التقديري')}
            valueLabel={fastestLabel}
            active={filters.fastest}
            selectedValue={filters.fastest ? 'fastest' : 'default'}
            items={fastestItems}
            isRtl={isRtl}
            icon={<Zap className="size-3.5 text-amber-500" />}
            onSelect={(v) => onChange({ ...filters, fastest: v === 'fastest' })}
          />
        </div>

        {showReset && (
          <button
            type="button"
            onClick={() => onChange({ ...DEFAULT_HOME_FILTERS })}
            className="flex shrink-0 items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-semibold text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:bg-slate-800"
            aria-label={t('Reset filters', 'إعادة ضبط الفلاتر')}
          >
            <RotateCcw className="size-3.5" aria-hidden />
            <span className="hidden sm:inline">{t('Reset', 'إعادة')}</span>
          </button>
        )}
      </div>
    </div>
  )
}
