'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { SuspendedClient } from './SuspendedClient'
import { DarkPageSkeleton } from '@/components/loading'

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
    <Suspense fallback={<DarkPageSkeleton />}>
      <SuspendedContent />
    </Suspense>
  )
}
