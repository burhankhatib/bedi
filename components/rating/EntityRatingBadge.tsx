'use client'

import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EntityRatingBadgeProps {
  averageScore: number
  totalCount: number
  className?: string
  showCount?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export function EntityRatingBadge({
  averageScore,
  totalCount,
  className,
  showCount = true,
  size = 'sm'
}: EntityRatingBadgeProps) {
  if (totalCount === 0) return null

  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base font-semibold',
  }
  
  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  }

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <div className={cn(
        "flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-500 font-medium",
        sizeClasses[size]
      )}>
        <Star className={cn("fill-current", iconSizes[size])} />
        <span>{averageScore.toFixed(1)}</span>
      </div>
      {showCount && (
        <span className={cn("text-slate-500 dark:text-slate-400", sizeClasses[size])}>
          ({totalCount > 99 ? '99+' : totalCount})
        </span>
      )}
    </div>
  )
}
