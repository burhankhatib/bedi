'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'motion/react'
import { useLocation } from '@/components/LocationContext'
import { useLanguage } from '@/components/LanguageContext'
import { BUSINESS_TYPES } from '@/lib/constants'

// react-icons/ci mapping
import { 
  CiForkAndKnife, 
  CiCoffeeCup, 
  CiShoppingBasket, 
  CiShop, 
  CiPill, 
  CiShop as CiOther 
} from 'react-icons/ci'

type CategoryIconMapping = {
  [key: string]: React.ElementType
}

const iconMapping: CategoryIconMapping = {
  restaurant: CiForkAndKnife,
  cafe: CiCoffeeCup,
  bakery: CiShop, // CiShop is a generic shop icon suitable for bakery if CiBread/CiCroissant is missing
  grocery: CiShoppingBasket,
  retail: CiShop,
  pharmacy: CiPill,
  other: CiOther,
}

type CategoryIconsBarProps = {
  activeCategory?: string
  className?: string
}

export function CategoryIconsBar({ activeCategory, className = '' }: CategoryIconsBarProps) {
  const { t, lang } = useLanguage()
  const { city, isChosen } = useLocation()
  const [availableCategories, setAvailableCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isChosen || !city) {
      setAvailableCategories([])
      setLoading(false)
      return
    }
    setLoading(true)
    const params = new URLSearchParams({ city })
    fetch(`/api/home/categories?${params}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          // data contains array of objects with 'value' property
          setAvailableCategories(data.map((c) => c.value))
        }
      })
      .catch(() => setAvailableCategories([]))
      .finally(() => setLoading(false))
  }, [isChosen, city])

  if (!isChosen || (loading && availableCategories.length === 0)) {
    return (
      <div className={`py-6 flex justify-center gap-4 sm:gap-6 md:gap-8 overflow-x-auto no-scrollbar px-4 ${className}`}>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-2 min-w-[70px]">
            <div className="w-14 h-14 rounded-full bg-slate-200 animate-pulse" />
            <div className="w-12 h-3 rounded-md bg-slate-200 animate-pulse" />
          </div>
        ))}
      </div>
    )
  }

  if (availableCategories.length === 0) return null

  // Filter BUSINESS_TYPES to only show those available in this city
  // and maintain the order defined in BUSINESS_TYPES
  const displayCategories = BUSINESS_TYPES.filter(bt => availableCategories.includes(bt.value))

  return (
    <div className={`py-6 w-full ${className}`}>
      <div className="flex justify-start md:justify-center gap-4 sm:gap-6 md:gap-8 overflow-x-auto no-scrollbar px-4 pb-4">
        {displayCategories.map((cat, i) => {
          const Icon = iconMapping[cat.value] || CiOther
          const isActive = activeCategory === cat.value
          
          return (
            <motion.div
              key={cat.value}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              className="flex-shrink-0"
            >
              <Link
                href={`/search?category=${encodeURIComponent(cat.value)}`}
                className="group flex flex-col items-center gap-2 w-16 sm:w-20 cursor-pointer outline-none"
              >
                <div 
                  className={`flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full transition-all duration-300 ease-in-out
                    ${isActive 
                      ? 'bg-emerald-100 text-emerald-600 shadow-md ring-2 ring-emerald-500 ring-offset-2' 
                      : 'bg-white text-slate-600 shadow-sm border border-slate-200 group-hover:bg-emerald-50 group-hover:text-emerald-500 group-hover:border-emerald-200 group-hover:shadow-md'
                    }
                  `}
                >
                  <motion.div
                    whileHover={{ scale: 1.15 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Icon className="w-7 h-7 sm:w-8 sm:h-8" />
                  </motion.div>
                </div>
                <span 
                  className={`text-xs sm:text-sm font-medium text-center transition-colors
                    ${isActive ? 'text-emerald-700 font-bold' : 'text-slate-600 group-hover:text-emerald-600'}
                  `}
                >
                  {lang === 'ar' ? cat.labelAr : cat.label}
                </span>
              </Link>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
