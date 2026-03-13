import { Skeleton } from '@/components/ui/skeleton'

/**
 * Order tracking/status page skeleton.
 */
export function OrderPageSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <Skeleton className="h-16 w-16 rounded-full mb-6" />
      <Skeleton className="h-6 w-48 mb-2" />
      <Skeleton className="h-4 w-32 mb-8" />
      <div className="w-full max-w-sm space-y-3">
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-14 w-full rounded-xl" />
      </div>
    </div>
  )
}
