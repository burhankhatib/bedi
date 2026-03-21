import { Skeleton } from '@/components/ui/skeleton'
import { BUSINESS_LISTING_CARD_GRID_CLASS } from '@/lib/ui/businessListingGrid'

/**
 * Search page skeleton: header, category strip, title, search bar, tenant grid.
 * Matches SearchPageClient layout so users see what's loading.
 */
export function SearchPageSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header placeholder — SiteHeader is ~72px */}
      <div className="sticky top-0 z-50 h-[72px] border-b border-slate-100 bg-white" />

      {/* Category strip (Specialty icons) */}
      <div className="bg-white border-b border-slate-100 px-4 py-4">
        <div className="flex gap-6 overflow-hidden">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex flex-col items-center gap-2 shrink-0 w-16">
              <Skeleton className="size-12 rounded-2xl" />
              <Skeleton className="h-3 w-14" />
            </div>
          ))}
        </div>
      </div>

      <main className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Title */}
        <Skeleton className="mb-6 h-8 w-64" />

        {/* Search bar + filter button */}
        <div className="mb-6 flex gap-3 items-center">
          <Skeleton className="h-14 flex-1 rounded-full" />
          <Skeleton className="size-14 rounded-full shrink-0" />
        </div>

        {/* Tenant cards (matches SearchPageClient business grid) */}
        <div className={`${BUSINESS_LISTING_CARD_GRID_CLASS} pt-4`}>
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-[300px] rounded-[20px] bg-white p-4 shadow-sm">
              <Skeleton className="mx-auto size-[160px] rounded-3xl" />
              <Skeleton className="mx-auto mt-4 h-5 w-4/5" />
              <Skeleton className="mx-auto mt-2 h-3 w-1/2" />
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
