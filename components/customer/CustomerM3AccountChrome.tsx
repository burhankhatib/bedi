'use client'

/**
 * Material Design 3 chrome for customer account flows (/profile, /my-orders).
 * Top app bar: 64dp height, icon nav + headline + optional trailing (8dp grid).
 */

import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { motion } from 'motion/react'
import { cn } from '@/lib/utils'

const M3_INSET = 'max-w-xl mx-auto px-4 md:px-6'

export function CustomerM3PageScaffold({
  children,
  className,
  dir,
}: {
  children: React.ReactNode
  className?: string
  dir?: 'ltr' | 'rtl'
}) {
  return (
    <div
      className={cn('min-h-screen pb-24 md:pb-10', className)}
      style={{ backgroundColor: 'var(--m3-surface)' }}
      dir={dir}
    >
      {children}
    </div>
  )
}

/** M3 small top app bar — sticky, surface container high, level-1 elevation. */
export function CustomerM3TopAppBar({
  title,
  backHref,
  backLabel,
  trailing,
  isRtl,
}: {
  title: string
  backHref: string
  backLabel: string
  trailing?: React.ReactNode
  isRtl: boolean
}) {
  const BackIcon = isRtl ? ChevronRight : ChevronLeft

  return (
    <header
      className="sticky top-0 z-30 shrink-0 border-b px-1 pt-[env(safe-area-inset-top,0px)] sm:px-2"
      style={{
        backgroundColor: 'var(--m3-surface-container-high)',
        borderColor: 'var(--m3-outline-variant)',
        boxShadow: 'var(--m3-elevation-1)',
      }}
    >
      <div className={cn(M3_INSET, 'flex h-16 w-full max-w-3xl items-center gap-1')}>
        <Link
          href={backHref}
          className={cn(
            'inline-flex min-h-12 min-w-12 items-center justify-center rounded-full transition-colors hover:bg-black/[0.06] active:bg-black/[0.1]',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--m3-primary)]'
          )}
          style={{ color: 'var(--m3-on-surface)' }}
          aria-label={backLabel}
        >
          <BackIcon className="size-6 stroke-[2]" aria-hidden />
        </Link>

        <h1
          className="min-w-0 flex-1 truncate text-center text-lg font-medium tracking-tight md:text-xl"
          style={{ color: 'var(--m3-on-surface)' }}
        >
          {title}
        </h1>

        <div className="flex min-h-12 min-w-12 items-center justify-end">
          {trailing ?? <span className="inline-block size-12" aria-hidden />}
        </div>
      </div>
    </header>
  )
}

/** Content column — max width for readability, 8dp-aligned padding. */
export function CustomerM3Content({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn(`${M3_INSET} max-w-3xl py-6 md:py-8`, className)}>{children}</div>
}

/** M3 elevated card — 16dp corner radius, elevation-2, surface container high. */
export function CustomerM3Card({
  children,
  className,
  noPadding,
}: {
  children: React.ReactNode
  className?: string
  noPadding?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border transition-shadow',
        !noPadding && 'p-5 md:p-6',
        className
      )}
      style={{
        backgroundColor: 'var(--m3-surface-container-high)',
        borderColor: 'var(--m3-outline-variant)',
        boxShadow: 'var(--m3-elevation-2)',
      }}
    >
      {children}
    </div>
  )
}

export function CustomerM3SectionTitle({
  title,
  subtitle,
}: {
  title: string
  subtitle?: string
}) {
  return (
    <div className="mb-4 space-y-1">
      <h2
        className="text-lg font-semibold tracking-tight md:text-xl"
        style={{ color: 'var(--m3-on-surface)' }}
      >
        {title}
      </h2>
      {subtitle ? (
        <p className="text-sm leading-relaxed md:text-base" style={{ color: 'var(--m3-on-surface-variant)' }}>
          {subtitle}
        </p>
      ) : null}
    </div>
  )
}

/** M3 filled button as navigation link — avoids invalid nested <a><button>. */
export function CustomerM3FilledLink({
  href,
  children,
  className,
}: {
  href: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex h-10 min-h-10 items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold',
        'transition-opacity hover:opacity-92 active:opacity-88',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
        className
      )}
      style={{
        backgroundColor: 'var(--m3-primary)',
        color: 'var(--m3-on-primary)',
        outlineColor: 'var(--m3-primary)',
      }}
    >
      {children}
    </Link>
  )
}

/** M3 tonal button as link (secondary emphasis). */
export function CustomerM3TonalLink({
  href,
  children,
  className,
}: {
  href: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex h-10 min-h-10 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold',
        'transition-colors hover:opacity-95 active:opacity-90',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
        className
      )}
      style={{
        backgroundColor: 'var(--m3-primary-container)',
        color: 'var(--m3-on-primary-container)',
        outlineColor: 'var(--m3-on-primary-container)',
      }}
    >
      {children}
    </Link>
  )
}

/** M3 outlined icon-style link (e.g. View all). */
export function CustomerM3OutlinedLink({
  href,
  children,
  className,
}: {
  href: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex h-10 items-center justify-center gap-1.5 rounded-full border-2 bg-transparent px-4 text-sm font-semibold',
        'transition-colors hover:bg-black/[0.04] active:bg-black/[0.06]',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
        className
      )}
      style={{
        borderColor: 'var(--m3-outline)',
        color: 'var(--m3-primary)',
        outlineColor: 'var(--m3-primary)',
      }}
    >
      {children}
    </Link>
  )
}

/** Section enter animation — M3 standard easing, 250ms. */
export function CustomerM3MotionSection({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode
  delay?: number
  className?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay, ease: [0.2, 0, 0, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
