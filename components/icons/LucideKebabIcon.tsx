'use client'

import dynamicIconImports from 'lucide-react/dynamicIconImports'
import { UtensilsCrossed, type LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'

type Props = {
  name: string | null | undefined
  className?: string
  size?: number
  strokeWidth?: number
}

const importers = dynamicIconImports as unknown as Record<string, () => Promise<{ default: LucideIcon }>>

export function LucideKebabIcon({ name, className, size = 48, strokeWidth = 1.5 }: Props) {
  const key = (name ?? '').trim().toLowerCase()
  const [Icon, setIcon] = useState<LucideIcon | null>(null)

  useEffect(() => {
    if (!key) {
      setIcon(null)
      return
    }
    const load = importers[key]
    if (!load) {
      setIcon(null)
      return
    }
    let cancelled = false
    load()
      .then((m) => {
        if (!cancelled) setIcon(() => m.default)
      })
      .catch(() => {
        if (!cancelled) setIcon(null)
      })
    return () => {
      cancelled = true
    }
  }, [key])

  const Cmp = Icon
  if (!Cmp) {
    return <UtensilsCrossed className={className} size={size} strokeWidth={strokeWidth} aria-hidden />
  }
  return <Cmp className={className} size={size} strokeWidth={strokeWidth} aria-hidden />
}
