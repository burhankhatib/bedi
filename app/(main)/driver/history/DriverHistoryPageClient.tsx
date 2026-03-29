'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'

const DriverHistoryClient = dynamic(() => import('./DriverHistoryClient').then((m) => m.DriverHistoryClient), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[40vh] items-center justify-center">
      <p className="text-slate-400">Loading…</p>
    </div>
  ),
})

/**
 * Defers mounting DriverHistoryClient until after the first paint.
 * Prevents the app from freezing when navigating from Orders to History.
 */
export function DriverHistoryPageClient() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Longer delay to ensure layout animations finish
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

  return <DriverHistoryClient />
}
