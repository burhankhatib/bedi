import { Suspense } from 'react'
import { SearchPageClient } from './SearchPageClient'
import { SearchPageSkeleton } from '@/components/loading'

export const dynamic = 'force-dynamic'

export default function SearchPage() {
  return (
    <Suspense fallback={<SearchPageSkeleton />}>
      <SearchPageClient />
    </Suspense>
  )
}
