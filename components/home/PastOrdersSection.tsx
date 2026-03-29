'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Store } from 'lucide-react'
import { useLanguage } from '@/components/LanguageContext'
import { useAuth } from '@clerk/nextjs'

type PastOrder = {
  _id: string
  siteSlug?: string
  siteName?: string
  siteLogo?: string
  totalAmount?: number
  currency?: string
  status?: string
}

export function PastOrdersSection() {
  const { t } = useLanguage()
  const { isLoaded, isSignedIn } = useAuth()
  const [orders, setOrders] = useState<PastOrder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      setLoading(false)
      
      // FOR MOCK PREVIEW ONLY: Show mock past orders if not signed in so we can preview the component
      setOrders([
        { _id: 'mock1', siteSlug: 'burger-king', siteName: 'Burger King', siteLogo: 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=400&q=80' },
        { _id: 'mock2', siteSlug: 'pizza-hut', siteName: 'Pizza Hut', siteLogo: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&q=80' },
        { _id: 'mock3', siteSlug: 'kfc', siteName: 'KFC', siteLogo: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&q=80' },
        { _id: 'mock4', siteSlug: 'mcdonalds', siteName: 'McDonalds', siteLogo: 'https://images.unsplash.com/photo-1619881589316-56c7f9e6b587?w=400&q=80' },
        { _id: 'mock5', siteSlug: 'subway', siteName: 'Subway', siteLogo: 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=400&q=80' }
      ])
      return
    }
    
    if (!isLoaded) return

    let mounted = true
    setLoading(true)
    fetch('/api/me/orders')
      .then(res => res.json())
      .then(data => {
        if (mounted && data.orders) {
          const uniqueOrders = data.orders.reduce((acc: PastOrder[], order: PastOrder) => {
             if (order.siteSlug && !acc.some(o => o.siteSlug === order.siteSlug)) {
                acc.push(order)
             }
             return acc
          }, []).slice(0, 8)
          
          setOrders(uniqueOrders)
        }
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoading(false)
      })
      return () => { mounted = false }
  }, [isLoaded, isSignedIn])

  if (loading || orders.length === 0) return null

  return (
    <section className="mx-auto max-w-7xl pt-4 pb-6 overflow-hidden">
      <div className="px-4 sm:px-6 mb-4 flex items-center justify-between">
        <h2 className="text-[19px] font-bold tracking-tight text-slate-900 md:text-2xl">
          {t('Your past orders', 'طلباتك السابقة')}
        </h2>
        <Link
          href="/orders"
          className="flex items-center text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors"
        >
          {t('See All', 'عرض الكل')}
        </Link>
      </div>
      
      <div className="flex overflow-x-auto gap-4 px-4 sm:px-6 pb-4 no-scrollbar snap-x">
        {orders.map((order) => (
          <Link
            href={order.siteSlug ? `/t/${order.siteSlug}` : '#'}
            key={order._id}
            className="group flex flex-col w-[240px] sm:w-[280px] shrink-0 snap-start outline-none bg-white rounded-[20px] border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="relative h-[110px] sm:h-32 w-full bg-slate-100 border-b border-slate-100">
              {order.siteLogo ? (
                <Image src={order.siteLogo} alt={order.siteName || ''} fill className="object-cover" sizes="280px" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Store className="size-8 text-slate-300" />
                </div>
              )}
            </div>
            <div className="p-3.5">
              <h3 className="font-bold text-slate-900 text-[16px] truncate">{order.siteName}</h3>
              <p className="text-[13px] font-medium text-slate-500 mt-0.5">{t('Reorder your favorites', 'أعد طلب مفضلاتك')}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
