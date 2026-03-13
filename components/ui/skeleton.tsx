import { cn } from '@/lib/utils'

/**
 * M3-styled skeleton for loading states.
 * 8dp grid spacing, smooth shimmer animation.
 * Use for Suspense fallbacks and route loading.
 */
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-lg bg-slate-200/80',
        'motion-reduce:animate-none',
        className
      )}
      aria-hidden="true"
      {...props}
    />
  )
}

export { Skeleton }
