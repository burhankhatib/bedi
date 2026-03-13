import { Skeleton } from '@/components/ui/skeleton'

/**
 * Dark-themed skeleton for suspended/driver areas.
 */
export function DarkPageSkeleton() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <Skeleton className="h-10 w-48 mx-auto bg-slate-700/80" />
        <Skeleton className="h-14 w-full rounded-xl bg-slate-700/80" />
        <Skeleton className="h-14 w-full rounded-xl bg-slate-700/80" />
      </div>
    </div>
  )
}
