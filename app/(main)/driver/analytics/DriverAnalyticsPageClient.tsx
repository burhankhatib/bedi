'use client'

import { useState, useEffect } from 'react'
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
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const id = setTimeout(() => setMounted(true), 300)
    return () => clearTimeout(id)
  }, [])

  if (!mounted) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-slate-400">Loading…</p>
      </div>
    )
  }

  return <DriverAnalyticsClient />
}
