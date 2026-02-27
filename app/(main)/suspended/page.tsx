'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { SuspendedClient } from './SuspendedClient'

type SuspendedType = 'business' | 'driver' | 'customer'

function SuspendedContent() {
  const searchParams = useSearchParams()
  const typeParam = searchParams.get('type')
  const type: SuspendedType =
    typeParam === 'driver' || typeParam === 'customer' ? typeParam : 'business'

  return <SuspendedClient type={type} />
}

export default function SuspendedPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400">Loading…</div>
      </div>
    }>
      <SuspendedContent />
    </Suspense>
  )
}
