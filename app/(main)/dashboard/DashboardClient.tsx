'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { AppNav } from '@/components/saas/AppNav'
import { BusinessPushSetup } from '@/components/BusinessPushSetup'
import { PWAManager } from '@/components/pwa/PWAManager'
import { useLanguage } from '@/components/LanguageContext'
import type { Tenant } from '@/lib/tenant'
import { Store, ExternalLink, LayoutGrid, Plus, ArrowRight } from 'lucide-react'
import { PREFER_TENANT_KEY } from '@/components/StandaloneDriverRedirect'
import { useEffect } from 'react'

export function DashboardClient({
  tenants,
  showAdmin,
  hasDriver,
}: {
  tenants: Tenant[]
  showAdmin: boolean
  hasDriver?: boolean
}) {
  const { t, lang } = useLanguage()

  useEffect(() => {
    try {
      localStorage.setItem(PREFER_TENANT_KEY, '1')
    } catch {
      // ignore
    }
  }, [])

  return (
    <div className="dark min-h-screen overflow-x-hidden bg-slate-950 text-white">
      <AppNav variant="dashboard" showAdmin={showAdmin} hasDriver={hasDriver} />

      <main className="mx-auto max-w-[100vw] px-4 py-6 sm:container sm:py-8 md:py-12">
        <PWAManager role="tenant-dashboard" variant="inline" />
        <BusinessPushSetup />
        <div className="mb-8">
          <h1 className="text-2xl font-bold md:text-3xl">{t('Dashboard', 'لوحة التحكم')}</h1>
          <p className="mt-1 text-slate-400">
            {t('Manage your sites. Edit menu & areas, or view orders.', 'إدارة مواقعك. تعديل القائمة والمناطق، أو عرض الطلبات.')}
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {tenants.map((tenant) => (
            <div
              key={tenant._id}
              className="group rounded-2xl border border-slate-800/60 bg-slate-900/40 p-6 transition-all hover:border-slate-700 hover:bg-slate-900/60"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 flex-1 items-start gap-4">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
                    <Store className="size-6" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate font-semibold text-white">{tenant.name}</h2>
                    <p className="mt-0.5 text-xs capitalize text-slate-500">{tenant.businessType}</p>
                    <p className="mt-2 font-mono text-xs text-slate-400">/t/{tenant.slug}</p>
                  </div>
                </div>
                <span className="shrink-0 rounded-full border border-slate-600 bg-slate-800/50 px-2.5 py-1 text-xs capitalize text-slate-300">
                  {tenant.subscriptionStatus}
                </span>
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                <Button asChild size="sm" className="border border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white">
                  <a href={`/t/${tenant.slug}`} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-1.5 size-3.5" />
                    {t('View menu', 'عرض القائمة')}
                  </a>
                </Button>
                <Button asChild size="sm" className="border border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white">
                  <a href={`/t/${tenant.slug}/manage`}>
                    <LayoutGrid className="mr-1.5 size-3.5" />
                    {t('Manage', 'إدارة')}
                  </a>
                </Button>
                <Button asChild size="sm" className="bg-amber-500 text-slate-950 hover:bg-amber-400">
                  <a href={`/t/${tenant.slug}/orders`}>
                    {t('Orders', 'الطلبات')}
                    <ArrowRight className="ml-1.5 size-3.5" />
                  </a>
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10">
          <Button asChild variant="ghost" size="sm" className="text-slate-400 hover:text-white">
            <Link href="/onboarding">
              <Plus className="mr-2 size-4" />
              {t('Add another site', 'إضافة موقع آخر')}
            </Link>
          </Button>
        </div>
      </main>
    </div>
  )
}
