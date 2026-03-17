'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Store, User, Receipt } from 'lucide-react'
import { useLocation } from '@/components/LocationContext'
import { useLanguage } from '@/components/LanguageContext'
import { useUser } from '@clerk/nextjs'

type Category = {
  _id: string
  value: string
  name_en: string
  name_ar: string
  imageUrl: string | null
  tenantCount: number
}

type StoreTypeSidebarProps = {
  activeCategory: string
  onChange: (category: string) => void
}

export function StoreTypeSidebar({ activeCategory, onChange }: StoreTypeSidebarProps) {
  const { lang, t } = useLanguage()
  const { city, isChosen } = useLocation()
  const { isSignedIn } = useUser()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [hasDriver, setHasDriver] = useState(false)
  const [hasTenants, setHasTenants] = useState(false)
  const [accountLoading, setAccountLoading] = useState(true)
  const initialCategorySet = useRef(false)
  const accountAbortRef = useRef<AbortController | null>(null)
  const categoriesAbortRef = useRef<AbortController | null>(null)
  const mountedRef = useRef(false)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      accountAbortRef.current?.abort()
      categoriesAbortRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    if (!isSignedIn) {
      accountAbortRef.current?.abort()
      setHasDriver(false)
      setHasTenants(false)
      setAccountLoading(false)
      return
    }
    setAccountLoading(true)
    accountAbortRef.current?.abort()
    const ac = new AbortController()
    accountAbortRef.current = ac
    fetch('/api/me/account-type', { signal: ac.signal })
      .then((res) => res.json())
      .then((data) => {
        if (!mountedRef.current || ac.signal.aborted) return
        setHasDriver(!!data.hasDriver)
        setHasTenants(!!data.hasTenants)
      })
      .catch((err) => {
        if ((err as Error)?.name === 'AbortError') return
        if (!mountedRef.current) return
        setHasDriver(false)
        setHasTenants(false)
      })
      .finally(() => {
        if (mountedRef.current && !ac.signal.aborted) setAccountLoading(false)
      })
  }, [isSignedIn])

  useEffect(() => {
    if (!isChosen || !city) {
      categoriesAbortRef.current?.abort()
      setCategories([])
      setLoading(false)
      return
    }
    setLoading(true)
    const params = new URLSearchParams({ city })
    categoriesAbortRef.current?.abort()
    const ac = new AbortController()
    categoriesAbortRef.current = ac
    fetch(`/api/home/categories?${params}`, { signal: ac.signal })
      .then((res) => res.json())
      .then((data) => {
        if (!mountedRef.current || ac.signal.aborted) return
        const list = Array.isArray(data) ? data : []
        setCategories(list)
        if (list.length > 0 && !initialCategorySet.current && activeCategory === 'restaurant') {
          const hasRestaurant = list.some((c: Category) => c.value === 'restaurant' && c.tenantCount > 0)
          if (!hasRestaurant) {
            initialCategorySet.current = true
            onChange(list[0]?.value ?? 'stores')
          }
        }
      })
      .catch((err) => {
        if ((err as Error)?.name === 'AbortError') return
        if (!mountedRef.current) return
        setCategories([])
      })
      .finally(() => {
        if (mountedRef.current && !ac.signal.aborted) setLoading(false)
      })
  }, [isChosen, city])

  if (!isChosen) return null

  // Ensure "restaurant" (if exists) is logically grouped nicely. We don't filter them out because dynamic categories might rely on it.
  
  const renderItem = (cat: Category) => {
    const isActive = activeCategory === cat.value
    return (
      <button
        key={cat.value}
        onClick={() => onChange(cat.value)}
        className={`group relative flex items-center w-full px-4 py-3 sm:py-3.5 gap-3 transition-all duration-300 md:rounded-2xl shrink-0 outline-none
          ${isActive ? 'bg-slate-100 text-brand-black' : 'bg-transparent text-slate-700 hover:bg-slate-50 hover:text-brand-black'}
        `}
      >
        <div className={`relative flex items-center justify-center shrink-0 size-8 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
          {cat.imageUrl ? (
            <Image
              src={cat.imageUrl}
              alt={lang === 'ar' ? cat.name_ar : cat.name_en}
              fill
              className="object-contain"
              sizes="32px"
            />
          ) : (
            <Store className="size-5" />
          )}
        </div>
        <span className={`text-[14px] leading-tight font-medium ${isActive ? 'font-bold' : ''}`}>
          {lang === 'ar' ? cat.name_ar : cat.name_en}
        </span>
        
        {/* Active Indicator Line for Desktop */}
        {isActive && (
          <div className="absolute left-0 top-0 bottom-0 w-[4px] bg-brand-yellow rounded-r-full hidden md:block" />
        )}
      </button>
    )
  }

  return (
    <>
      {/* Desktop Sidebar (Left side, or right if RTL, standard flow takes care of it) */}
      <aside className="hidden md:flex flex-col justify-between w-[240px] shrink-0 self-start py-2 border-r border-slate-100 rtl:border-l rtl:border-r-0 min-h-[400px]">
        <div className="flex-1 pb-4">
          <nav className="flex flex-col gap-1 pr-4 rtl:pr-0 rtl:pl-4">
            <div className="mb-4 px-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                {t('Explore Types', 'استكشف الأنواع')}
              </h3>
            </div>
            {loading ? (
              [...Array(5)].map((_, i) => (
                <div key={i} className="h-10 animate-pulse bg-slate-200/60 rounded-xl mb-2" />
              ))
            ) : (
              categories.map(renderItem)
            )}
          </nav>
        </div>

        {/* Sidebar Footer / CTA Area */}
        <div className="flex flex-col gap-3 pr-4 rtl:pr-0 rtl:pl-4 mt-auto">
          {isSignedIn && (
            <>
              <div className="h-px bg-slate-200 mb-2" />
              <Link href="/profile" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-100 transition-colors text-slate-600 hover:text-brand-black font-medium text-sm">
                <User className="size-[18px]" />
                {t('My Profile', 'حسابي')}
              </Link>
              <Link href="/my-orders" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-100 transition-colors text-slate-600 hover:text-brand-black font-medium text-sm">
                <Receipt className="size-[18px]" />
                {t('My Orders', 'طلباتي')}
              </Link>
            </>
          )}
          <div className="mt-4 flex flex-col gap-2.5">
            {accountLoading && isSignedIn ? (
              <div className="h-24 animate-pulse rounded-xl bg-slate-200/60" />
            ) : (
              <>
            {hasDriver ? (
              <a href="/driver" className="flex items-center justify-center w-full py-3.5 rounded-xl bg-brand-red text-white font-bold text-[15px] tracking-tight hover:brightness-110 transition-all shadow-sm">
                {t('Driver Dashboard', 'لوحة السائق')}
              </a>
            ) : (
              <a href="/sign-up?redirect_url=/driver" className="flex items-center justify-center w-full py-3.5 rounded-xl bg-brand-red text-white font-bold text-[15px] tracking-tight hover:brightness-110 transition-all shadow-sm">
                {t('Drive with us', 'انضم ككابتن')}
              </a>
            )}
            {hasTenants ? (
              <a href="/dashboard" className="flex items-center justify-center w-full py-3.5 rounded-xl bg-brand-black text-white font-bold text-[15px] tracking-tight hover:bg-brand-black/90 transition-all shadow-sm">
                {t('Business Dashboard', 'لوحة الأعمال')}
              </a>
            ) : (
              <a href="/sign-up?redirect_url=/onboarding" className="flex items-center justify-center w-full py-3.5 rounded-xl bg-brand-black text-white font-bold text-[15px] tracking-tight hover:bg-brand-black/90 transition-all shadow-sm">
                {t('Add your business', 'أضف عملك')}
              </a>
            )}
              </>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile Top Scroll Bar */}
      <div className="md:hidden sticky top-[60px] z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 md:border-none shadow-sm pb-1 mb-4">
        <div className="flex overflow-x-auto no-scrollbar gap-2 px-4 py-2">
          {loading ? (
            [...Array(4)].map((_, i) => (
              <div key={i} className="w-24 h-10 shrink-0 animate-pulse bg-slate-200/60 rounded-full" />
            ))
          ) : (
            categories.map((cat) => (
              <button
                key={cat.value}
                onClick={() => onChange(cat.value)}
                className={`flex items-center gap-2 shrink-0 px-4 py-2 rounded-full border transition-all duration-300 outline-none
                  ${activeCategory === cat.value
                    ? 'bg-brand-yellow border-brand-yellow text-brand-black shadow-md'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
              >
                {cat.imageUrl && (
                  <div className="relative size-5 shrink-0">
                    <Image
                      src={cat.imageUrl}
                      alt={lang === 'ar' ? cat.name_ar : cat.name_en}
                      fill
                      className="object-contain"
                      sizes="20px"
                    />
                  </div>
                )}
                <span className={`text-sm tracking-tight ${activeCategory === cat.value ? 'font-bold' : 'font-medium'}`}>
                  {lang === 'ar' ? cat.name_ar : cat.name_en}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </>
  )
}
