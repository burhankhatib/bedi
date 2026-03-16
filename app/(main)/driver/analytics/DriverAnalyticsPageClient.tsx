'use client'

import dynamic from 'next/dynamic'

const DriverAnalyticsClient = dynamic(() => import('./DriverAnalyticsClient').then((m) => m.DriverAnalyticsClient), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[40vh] items-center justify-center">
      <p className="text-slate-400">Loading…</p>
    </div>
  ),
})

export function DriverAnalyticsPageClient() {
  return <DriverAnalyticsClient />
}
