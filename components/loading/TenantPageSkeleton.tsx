import { Skeleton } from '@/components/ui/skeleton'

/**
 * Tenant/menu page skeleton: header, hero, category pills, product grid.
 * Matches MenuLayout structure so users see what's loading.
 */
export function TenantPageSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50 pb-24 md:pb-0">
      {/* Header placeholder */}
      <div className="sticky top-0 z-40 h-[72px] border-b border-slate-100 bg-white flex items-center px-4" />

      {/* Hero/banner area */}
      <div className="bg-slate-100">
        <Skeleton className="h-48 md:h-56 w-full rounded-none" />
      </div>

      {/* Category pills */}
      <div className="border-b border-slate-100 bg-white px-4 py-3 flex gap-2 overflow-hidden">
        <Skeleton className="h-9 w-20 rounded-full shrink-0" />
        <Skeleton className="h-9 w-24 rounded-full shrink-0" />
        <Skeleton className="h-9 w-16 rounded-full shrink-0" />
        <Skeleton className="h-9 w-28 rounded-full shrink-0" />
        <Skeleton className="h-9 w-20 rounded-full shrink-0" />
      </div>

      <main className="container mx-auto px-4 py-6 max-w-5xl">
        {/* Section title */}
        <Skeleton className="mb-4 h-6 w-40" />

        {/* Product grid — 2 cols mobile, 3 desktop */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {[...Array(9)].map((_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="aspect-square w-full rounded-2xl" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-5 w-1/2" />
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
