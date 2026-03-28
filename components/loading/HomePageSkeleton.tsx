import { Skeleton } from '@/components/ui/skeleton'
import { BUSINESS_LISTING_CARD_GRID_CLASS } from '@/lib/ui/businessListingGrid'

/**
 * Home page skeleton: header, sidebar, category strip, banner, featured grid, popular section.
 * Matches HomePageNew layout so users see what's loading.
 */
export function HomePageSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      {/* Header placeholder */}
      <div className="sticky top-0 z-50 border-b border-slate-100 bg-white pt-[env(safe-area-inset-top,0px)]">
        <div className="h-[72px]" aria-hidden />
      </div>

      <main className="container mx-auto px-4 py-6 max-w-[1440px]">
        <div className="flex flex-col md:flex-row md:gap-8 mb-8">
          {/* Sidebar (desktop) */}
          <div className="hidden md:flex md:w-48 shrink-0 flex-col gap-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-10 w-full rounded-xl" />
            ))}
          </div>

          {/* Main content area */}
          <div className="flex-1 min-w-0 flex flex-col gap-6">
            {/* Category icons strip */}
            <div className="flex gap-4 overflow-hidden">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="flex flex-col items-center gap-2 shrink-0 w-16">
                  <Skeleton className="size-12 rounded-2xl" />
                  <Skeleton className="h-3 w-12" />
                </div>
              ))}
            </div>

            {/* Banner */}
            <Skeleton className="h-[320px] md:h-[420px] w-full rounded-2xl" />
          </div>
        </div>

        {/* Featured places section */}
        <div className="mb-10">
          <Skeleton className="mb-6 h-7 w-48" />
          <div className={BUSINESS_LISTING_CARD_GRID_CLASS}>
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-[300px] rounded-[20px] bg-white p-4 shadow-sm">
                <Skeleton className="mx-auto size-[160px] rounded-3xl" />
                <Skeleton className="mx-auto mt-4 h-5 w-4/5" />
                <Skeleton className="mx-auto mt-2 h-3 w-1/2" />
              </div>
            ))}
          </div>
        </div>

        {/* Popular dishes section */}
        <div>
          <Skeleton className="mb-6 h-7 w-56" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex flex-col gap-2">
                <Skeleton className="aspect-[4/3] w-full rounded-2xl" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-5 w-1/2" />
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
