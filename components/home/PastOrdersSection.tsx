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
  itemImageUrl?: string | null
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
    if (!isLoaded) return
    if (!isSignedIn) {
      setOrders([])
      setLoading(false)
      return
    }

    let mounted = true
    setLoading(true)
    fetch('/api/me/orders')
      .then((res) => (res.ok ? res.json() : { orders: [] }))
      .then((data) => {
        if (!mounted || !data.orders) return
        const list = data.orders as PastOrder[]
        const bySlug = new Map<string, PastOrder>()
        for (const order of list) {
          if (!order.siteSlug) continue
          const existing = bySlug.get(order.siteSlug)
          if (!existing) {
            bySlug.set(order.siteSlug, { ...order })
          } else {
            bySlug.set(order.siteSlug, {
              ...existing,
              itemImageUrl: existing.itemImageUrl || order.itemImageUrl || null,
              siteLogo: existing.siteLogo || order.siteLogo,
            })
          }
        }
        setOrders(Array.from(bySlug.values()).slice(0, 8))
      })
      .catch(() => {
        if (mounted) setOrders([])
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [isLoaded, isSignedIn])

  if (!isLoaded || loading) return null
  if (!isSignedIn || orders.length === 0) return null

  return (
    <section className="mx-auto max-w-7xl overflow-hidden pb-6 pt-4">
      <div className="mb-4 flex items-center justify-between px-4 sm:px-6">
        <h2 className="text-[19px] font-bold tracking-tight text-slate-900 md:text-2xl">
          {t('Your past orders', 'طلباتك السابقة')}
        </h2>
        <Link
          href="/orders"
          className="flex items-center text-sm font-semibold text-slate-500 transition-colors hover:text-slate-800"
        >
          {t('See All', 'عرض الكل')}
        </Link>
      </div>

      <div className="no-scrollbar flex snap-x gap-4 overflow-x-auto px-4 pb-4 sm:px-6">
        {orders.map((order) => {
          const heroSrc = order.itemImageUrl || order.siteLogo || null
          return (
            <Link
              href={order.siteSlug ? `/t/${order.siteSlug}` : '#'}
              key={order._id}
              className="group flex w-[240px] shrink-0 snap-start flex-col overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-sm outline-none transition-shadow hover:shadow-md sm:w-[280px]"
            >
              <div className="relative h-[110px] w-full border-b border-slate-100 bg-slate-100 sm:h-32">
                {heroSrc ? (
                  <Image
                    src={heroSrc}
                    alt={order.siteName || ''}
                    fill
                    className="object-cover"
                    sizes="280px"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Store className="size-8 text-slate-300" />
                  </div>
                )}
              </div>
              <div className="p-3.5">
                <h3 className="truncate text-[16px] font-bold text-slate-900">{order.siteName}</h3>
                <p className="mt-0.5 text-[13px] font-medium text-slate-500">
                  {t('Reorder your favorites', 'أعد طلب مفضلاتك')}
                </p>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
