'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { useLanguage } from '@/components/LanguageContext'
import { motion } from 'motion/react'
import { Menu, MapPin, Truck, ArrowLeft, Store, LayoutGrid, TrendingUp, History, ShoppingBag, ArrowRightLeft, CreditCard, Table, Users } from 'lucide-react'
import type { StaffPermission } from '@/lib/staff-permissions'

const MANAGE_NAV_ITEMS: { path: string; labelEn: string; labelAr: string; icon: React.ComponentType<{ className?: string }>; permission?: StaffPermission }[] = [
  { path: '/business', labelEn: 'Business profile', labelAr: 'الملف التعريفي', icon: Store, permission: 'settings_business' },
  { path: '/menu', labelEn: 'Menu', labelAr: 'القائمة', icon: Menu, permission: 'settings_menu' },
  { path: '/tables', labelEn: 'Tables', labelAr: 'الطاولات', icon: Table, permission: 'settings_tables' },
  { path: '/areas', labelEn: 'Delivery areas', labelAr: 'مناطق التوصيل', icon: MapPin, permission: 'settings_areas' },
  { path: '/drivers', labelEn: 'Drivers', labelAr: 'السائقون', icon: Truck, permission: 'settings_drivers' },
  { path: '/analytics', labelEn: 'Analytics', labelAr: 'التحليلات', icon: TrendingUp, permission: 'analytics' },
  { path: '/history', labelEn: 'History', labelAr: 'السجل', icon: History, permission: 'history' },
  { path: '/billing', labelEn: 'Billing', labelAr: 'الدفع والفوترة', icon: CreditCard, permission: 'billing' },
  { path: '/transfer', labelEn: 'Transfer ownership', labelAr: 'نقل الملكية', icon: ArrowRightLeft, permission: 'transfer' },
  { path: '/staff', labelEn: 'Staff', labelAr: 'الموظفون', icon: Users, permission: 'staff_manage' },
]

export function ManageNavClient({ slug, permissions }: { slug: string; permissions?: StaffPermission[] }) {
  const hasPermission = (p?: StaffPermission) => !p || (Array.isArray(permissions) && permissions.includes(p))
  const navItems = MANAGE_NAV_ITEMS.filter((item) => hasPermission(item.permission))
  const [open, setOpen] = useState(false)
  const [newOrdersCount, setNewOrdersCount] = useState(0)
  const { t, lang } = useLanguage()
  const fetchedSlugRef = useRef<string | null>(null)

  useEffect(() => {
    if (fetchedSlugRef.current === slug) return
    fetchedSlugRef.current = slug
    fetch(`/api/tenants/${slug}/orders/count`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => setNewOrdersCount(typeof data?.newCount === 'number' ? data.newCount : 0))
      .catch(() => {})
  }, [slug])

  const ordersHref = `/t/${slug}/orders`
  const base = `/t/${slug}/manage`
  const manageNav = navItems.map(({ path, labelEn, labelAr, icon }) => ({
    href: `${base}${path}`,
    label: t(labelEn, labelAr),
    icon,
  }))

  const NewOrdersBadge = ({ compact = false }: { compact?: boolean }) =>
    newOrdersCount > 0 ? (
      <motion.span
        key={newOrdersCount}
        initial={{ scale: 1.3 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 15 }}
        className={`inline-flex items-center justify-center rounded-full bg-amber-500 text-slate-950 font-bold shadow-[0_0_12px_rgba(245,158,11,0.5)] ${compact ? 'min-w-[20px] h-5 px-1.5 text-xs' : 'min-w-[24px] h-6 px-2 text-sm'}`}
      >
        {newOrdersCount > 99 ? '99+' : newOrdersCount}
      </motion.span>
    ) : null

  return (
    <>
      <div className="mb-4 flex min-w-0 flex-wrap items-center gap-2 sm:mb-6">
        <Button asChild variant="ghost" size="sm" className="shrink-0 text-slate-400 hover:bg-slate-800 hover:text-white">
          <Link href="/dashboard">
            <ArrowLeft className="mr-1.5 size-4 shrink-0" />
            {t('Dashboard', 'لوحة التحكم')}
          </Link>
        </Button>
        <span className="shrink-0 text-slate-600">/</span>
        <span className="min-w-0 truncate font-medium text-white">{t('Manage', 'إدارة')}: {slug}</span>
      </div>

      {/* Desktop: prominent Orders button + all sections */}
      <nav className="mb-6 hidden flex-wrap items-center gap-2 border-b border-slate-800/60 pb-4 md:flex">
        <Button
          asChild
          size="default"
          className="min-h-11 rounded-xl bg-amber-500 px-5 font-semibold text-slate-950 shadow-md transition-all hover:bg-amber-400 hover:shadow-amber-500/20 md:min-h-12 md:px-6 md:text-base"
        >
          <Link href={ordersHref} className="inline-flex items-center gap-2">
            <ShoppingBag className="size-5 shrink-0" />
            {t('Orders', 'الطلبات')}
            <NewOrdersBadge />
          </Link>
        </Button>
        {navItems.map(({ path, labelEn, labelAr, icon: Icon }) => (
          <Button
            key={path}
            asChild
            variant="ghost"
            size="sm"
            className="text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <Link href={`${base}${path}`}>
              <Icon className="mr-1.5 size-4 shrink-0" />
              {t(labelEn, labelAr)}
            </Link>
          </Button>
        ))}
      </nav>

      {/* Mobile: hamburger + Orders CTA */}
      <div className="mb-6 flex flex-col gap-3 md:hidden">
        <Link
          href={ordersHref}
          className="flex items-center justify-between rounded-xl border-2 border-amber-500/60 bg-amber-500/15 px-4 py-3.5 font-semibold text-amber-400 shadow-sm transition-colors active:scale-[0.99]"
        >
          <span className="flex items-center gap-2">
            <ShoppingBag className="size-5 shrink-0" />
            {t('Orders', 'الطلبات')}
          </span>
          <NewOrdersBadge compact />
        </Link>
        <Button
          variant="outline"
          size="lg"
          className="w-full justify-center gap-3 rounded-xl border-2 border-slate-600 bg-slate-800/60 py-5 text-base font-semibold text-white shadow-md transition-colors hover:border-slate-500 hover:bg-slate-700/80 active:scale-[0.99]"
          onClick={() => setOpen(true)}
        >
          <LayoutGrid className="size-5 shrink-0" />
          {t('All admin sections', 'كل أقسام الإدارة')}
        </Button>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            side={lang === 'ar' ? 'left' : 'right'}
            className="w-[min(100vw-2rem,320px)] border-slate-800 bg-slate-950 p-0 [&_button]:text-slate-400 [&_button]:hover:bg-slate-800 [&_button]:hover:text-white"
          >
            <SheetTitle className="sr-only">{t('Admin sections', 'أقسام الإدارة')}</SheetTitle>
            <nav className="flex flex-col py-4">
              <Link
                href={ordersHref}
                className="mx-3 mb-2 flex items-center justify-between rounded-lg bg-amber-500/20 px-4 py-3.5 font-semibold text-amber-400 hover:bg-amber-500/30"
                onClick={() => setOpen(false)}
              >
                <span className="flex items-center gap-3">
                  <ShoppingBag className="size-5 shrink-0" />
                  {t('Orders', 'الطلبات')}
                </span>
                <NewOrdersBadge compact />
              </Link>
              <div className="mx-3 my-2 border-t border-slate-800" />
              {manageNav.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-3 px-6 py-3.5 text-slate-200 hover:bg-slate-800/80 hover:text-white"
                  onClick={() => setOpen(false)}
                >
                  <Icon className="size-5 shrink-0" />
                  {label}
                </Link>
              ))}
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </>
  )
}
