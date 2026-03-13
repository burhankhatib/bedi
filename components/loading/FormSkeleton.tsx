import { Skeleton } from '@/components/ui/skeleton'

/**
 * Centered form-like skeleton for auth/verify pages.
 */
export function FormSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <Skeleton className="h-10 w-48 mx-auto" />
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>
    </div>
  )
}
