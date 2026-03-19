'use client'

import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import { cn } from '@/lib/utils'

const PX = { sm: 36, md: 42, lg: 48 } as const

export type CustomerProfileAvatarSize = keyof typeof PX

/** Clerk avatar / initials — use inside menus or custom links. */
export function CustomerProfileAvatar({
  size = 'md',
  className,
}: {
  size?: CustomerProfileAvatarSize
  className?: string
}) {
  const { user, isSignedIn } = useUser()
  if (!isSignedIn || !user) return null

  const px = PX[size]
  const url = user.imageUrl
  const label = user.fullName || user.primaryEmailAddress?.emailAddress || user.username || '?'
  const initial = label.trim().slice(0, 1).toUpperCase() || '?'

  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 overflow-hidden rounded-full bg-slate-200 ring-2 ring-slate-200',
        className
      )}
      style={{ width: px, height: px }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- Clerk CDN host varies by project; avoid remotePatterns churn
        <img src={url} alt="" width={px} height={px} className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-sm font-bold text-slate-700">
          {initial}
        </span>
      )}
    </span>
  )
}

/** Header / nav: tap avatar → customer profile. */
export function CustomerProfileAvatarLink({
  size = 'md',
  className,
  ariaLabel,
}: {
  size?: CustomerProfileAvatarSize
  className?: string
  /** e.g. t('My profile', 'حسابي') */
  ariaLabel: string
}) {
  const { isSignedIn } = useUser()
  if (!isSignedIn) return null

  return (
    <Link
      href="/profile"
      className={cn(
        'touch-manipulation rounded-full outline-none transition-opacity hover:opacity-90 active:opacity-80',
        'focus-visible:ring-2 focus-visible:ring-[color:var(--m3-primary)] focus-visible:ring-offset-2',
        className
      )}
      aria-label={ariaLabel}
    >
      <CustomerProfileAvatar size={size} className="ring-slate-300" />
    </Link>
  )
}
