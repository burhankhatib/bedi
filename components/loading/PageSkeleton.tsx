import { Skeleton } from '@/components/ui/skeleton'

/**
 * Generic page skeleton for route transitions.
 * Header bar + content area. Use for /about, /contact, /privacy, etc.
 */
export function PageSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50 pb-24 md:pb-0">
      {/* Header placeholder (72px) */}
      <div className="sticky top-0 z-50 border-b border-slate-100 bg-white pt-[env(safe-area-inset-top,0px)]">
        <div className="flex h-[72px] items-center px-4">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="ml-auto h-10 w-10 rounded-full" />
        </div>
      </div>
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <Skeleton className="mb-8 h-10 w-3/4 max-w-md" />
        <div className="space-y-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      </main>
    </div>
  )
}
