'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/components/LanguageContext'
import { Menu, MapPin, Truck, ArrowLeft, Store, TrendingUp, History, ShoppingBag, ArrowRightLeft, CreditCard, Table, Users } from 'lucide-react'
import type { StaffPermission } from '@/lib/staff-permissions'
import { TenantSidebarActions } from './TenantSidebarActions'

const NAV_GROUPS = [
  {
    titleEn: 'Settings',
    titleAr: 'الإعدادات',
    items: [
      { path: '/business', labelEn: 'Business profile', labelAr: 'الملف التعريفي', icon: Store, permission: 'settings_business' },
      { path: '/billing', labelEn: 'Billing', labelAr: 'الدفع والفوترة', icon: CreditCard, permission: 'billing' },
      { path: '/transfer', labelEn: 'Transfer ownership', labelAr: 'نقل الملكية', icon: ArrowRightLeft, permission: 'transfer' },
    ]
  },
  {
    titleEn: 'Operations',
    titleAr: 'العمليات',
    items: [
      { path: '/menu', labelEn: 'Menu', labelAr: 'القائمة', icon: Menu, permission: 'settings_menu' },
      { path: '/tables', labelEn: 'Tables', labelAr: 'الطاولات', icon: Table, permission: 'settings_tables' },
      // Delivery Areas and Drivers hidden: auto distance-based pricing in use; drivers managed centrally
      // { path: '/areas', labelEn: 'Delivery areas', labelAr: 'مناطق التوصيل', icon: MapPin, permission: 'settings_areas' },
      // { path: '/drivers', labelEn: 'Drivers', labelAr: 'السائقون', icon: Truck, permission: 'settings_drivers' },
    ]
  },
  {
    titleEn: 'Management',
    titleAr: 'الإدارة',
    items: [
      { path: '/staff', labelEn: 'Staff', labelAr: 'الموظفون', icon: Users, permission: 'staff_manage' },
      { path: '/analytics', labelEn: 'Analytics', labelAr: 'التحليلات', icon: TrendingUp, permission: 'analytics' },
      { path: '/history', labelEn: 'History', labelAr: 'السجل', icon: History, permission: 'history' },
    ]
  }
]

export function ManageNavClient({ slug, permissions }: { slug: string; permissions?: StaffPermission[] }) {
  const hasPermission = (p?: string) => !p || (Array.isArray(permissions) && permissions.includes(p as StaffPermission))
  const [newOrdersCount, setNewOrdersCount] = useState(0)
  const { t, lang } = useLanguage()
  const pathname = usePathname()
  const fetchedSlugRef = useRef<string | null>(null)
  const ordersCountAbortRef = useRef<AbortController | null>(null)
  const isMountedRef = useRef(false)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      ordersCountAbortRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    if (fetchedSlugRef.current === slug) return
    fetchedSlugRef.current = slug
    ordersCountAbortRef.current?.abort()
    const ac = new AbortController()
    ordersCountAbortRef.current = ac
    fetch(`/api/tenants/${slug}/orders/count`, { cache: 'no-store', signal: ac.signal })
      .then((r) => r.json())
      .then((data) => {
        if (!isMountedRef.current || ac.signal.aborted) return
        setNewOrdersCount(typeof data?.newCount === 'number' ? data.newCount : 0)
      })
      .catch((err) => {
        if ((err as Error)?.name === 'AbortError') return
        if (!isMountedRef.current) return
        setNewOrdersCount(0)
      })
  }, [slug])

  const ordersHref = `/t/${slug}/orders`
  const base = `/t/${slug}/manage`

  const NewOrdersBadge = ({ compact = false }: { compact?: boolean }) =>
    newOrdersCount > 0 ? (
      <span
        className={`inline-flex items-center justify-center rounded-full bg-slate-900 text-amber-400 font-bold ${compact ? 'min-w-[20px] h-5 px-1.5 text-xs' : 'min-w-[24px] h-6 px-2 text-sm'}`}
      >
        {newOrdersCount > 99 ? '99+' : newOrdersCount}
      </span>
    ) : null

  // Flatten items for mobile scrollable nav
  const allNavItems = NAV_GROUPS.flatMap(g => g.items).filter(item => hasPermission(item.permission))

  return (
    <div className="flex flex-col md:h-full">
      {/* Desktop & Mobile Header / Breadcrumb */}
      <div className="mb-4 flex min-w-0 flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="sm" className="shrink-0 text-slate-400 hover:bg-slate-800 hover:text-white rounded-full touch-manipulation">
          <Link href="/dashboard">
            <ArrowLeft className="mr-1.5 size-4 shrink-0 rtl:ml-1.5 rtl:mr-0 rtl:rotate-180" />
            {t('Dashboard', 'لوحة التحكم')}
          </Link>
        </Button>
        <span className="shrink-0 text-slate-600">/</span>
        <span className="min-w-0 truncate font-medium text-white px-2">{t('Manage', 'إدارة')}: {slug}</span>
      </div>

      {/* Primary Orders Banner */}
      <Link
        href={ordersHref}
        className="group relative overflow-hidden mb-6 flex items-center justify-between rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500 to-amber-400 px-5 py-4 font-bold text-slate-950 shadow-lg shadow-amber-500/20 transition-all active:scale-[0.98] hover:shadow-amber-500/40 touch-manipulation"
      >
        <span className="flex items-center gap-3 relative z-10">
          <ShoppingBag className="size-6 shrink-0" />
          <span className="text-lg tracking-wide">{t('Orders', 'الطلبات')}</span>
        </span>
        <div className="relative z-10">
          <NewOrdersBadge />
        </div>
        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out rounded-2xl pointer-events-none"></div>
      </Link>

      {/* Mobile: Horizontal Scrollable Chip Menu */}
      <div className="md:hidden -mx-4 px-4 mb-6 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <div className="flex gap-2 w-max pb-2">
          {allNavItems.map(({ path, labelEn, labelAr, icon: Icon }) => {
            const href = `${base}${path}`
            const isActive = pathname === href
            return (
              <Link
                key={href}
                href={href}
                className={`relative flex items-center gap-2 px-4 py-3 rounded-full text-sm font-semibold transition-colors touch-manipulation ${
                  isActive ? 'text-amber-400' : 'text-slate-400 bg-slate-900 border border-slate-800'
                }`}
              >
                {isActive && (
                  <div
                    className="absolute inset-0 rounded-full bg-amber-500/10 border border-amber-500/30 pointer-events-none"
                  />
                )}
                <Icon className="size-4 relative z-10" />
                <span className="relative z-10 whitespace-nowrap">{t(labelEn, labelAr)}</span>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Desktop: Sidebar Navigation */}
      <nav className="hidden md:flex flex-col gap-6 flex-1">
        {NAV_GROUPS.map((group, idx) => {
          const items = group.items.filter(item => hasPermission(item.permission))
          if (items.length === 0) return null
          return (
            <div key={idx} className="flex flex-col gap-1">
              <h3 className="px-4 text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                {t(group.titleEn, group.titleAr)}
              </h3>
              {items.map(({ path, labelEn, labelAr, icon: Icon }) => {
                const href = `${base}${path}`
                const isActive = pathname === href
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`relative flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-colors group overflow-hidden touch-manipulation ${
                      isActive ? 'text-amber-400' : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {isActive && (
                      <div
                        className="absolute inset-0 rounded-2xl bg-amber-500/10 border border-amber-500/30 pointer-events-none"
                      />
                    )}
                    {!isActive && (
                      <div className="absolute inset-0 rounded-2xl bg-slate-800/0 group-hover:bg-slate-800/50 transition-colors pointer-events-none" />
                    )}
                    <Icon className={`size-5 relative z-10 ${isActive ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-300'}`} />
                    <span className="relative z-10">{t(labelEn, labelAr)}</span>
                  </Link>
                )
              })}
            </div>
          )
        })}
        
        <div className="mt-auto pt-6 border-t border-slate-800/60">
          <TenantSidebarActions slug={slug} />
        </div>
      </nav>
      
      {/* Mobile: Tenant Sidebar Actions */}
      <div className="md:hidden mb-4">
        <TenantSidebarActions slug={slug} />
      </div>
    </div>
  )
}
