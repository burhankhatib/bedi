'use client'

import dynamic from 'next/dynamic'

const StudioClient = dynamic(
  () => import('./StudioClient').then((mod) => mod.StudioClient),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <span className="text-slate-500">Loading Studio…</span>
      </div>
    ),
  }
)

export function StudioLoader() {
  return <StudioClient />
}
