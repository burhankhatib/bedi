'use client'

import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'

interface StarInputProps {
  value: number
  onChange: (value: number) => void
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export function StarInput({ value, onChange, disabled, size = 'lg' }: StarInputProps) {
  const [hoverValue, setHoverValue] = useState(0)

  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
  }

  return (
    <div className="flex gap-2 items-center" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((star) => {
        const isFilled = (hoverValue || value) >= star
        return (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={`${star} star${star > 1 ? 's' : ''}`}
            disabled={disabled}
            onMouseEnter={() => !disabled && setHoverValue(star)}
            onMouseLeave={() => !disabled && setHoverValue(0)}
            onClick={() => !disabled && onChange(star)}
            className={cn(
              'rounded-full p-1 transition-transform active:scale-[0.9]',
              disabled && 'opacity-50 cursor-not-allowed',
              !disabled && 'hover:bg-amber-50 dark:hover:bg-amber-950/30'
            )}
          >
            <Star
              className={cn(
                sizeClasses[size],
                isFilled ? 'fill-amber-500 text-amber-500' : 'text-slate-300 dark:text-slate-600'
              )}
            />
          </button>
        )
      })}
    </div>
  )
}
