'use client'

import dynamic from 'next/dynamic'

const DriverHistoryClient = dynamic(() => import('./DriverHistoryClient').then((m) => m.DriverHistoryClient), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[40vh] items-center justify-center">
      <p className="text-slate-400">Loading…</p>
    </div>
  ),
})

export function DriverHistoryPageClient() {
  return <DriverHistoryClient />
}
