'use client'

import { useEffect, useRef } from 'react'

/** Skip pull when a modal/sheet has body scroll locked (avoids touch conflict and freeze). */
function isOverlayOpen(): boolean {
  if (typeof document === 'undefined') return false
  return document.body.style.overflow === 'hidden' || !!document.body.getAttribute('data-scroll-locked')
}

/**
 * iOS PWA has native pull-to-refresh disabled. Use pulltorefreshjs to restore it.
 * Only runs when navigator.standalone === true (iOS standalone PWA).
 * Android PWA keeps native pull-to-refresh, so we skip it there.
 */
export function DriverIOSPullToRefresh() {
  const ptrRef = useRef<{ destroy: () => void } | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    // navigator.standalone is iOS-only; display-mode: standalone also matches Android
    const isIOSStandalone =
      (window.navigator as unknown as { standalone?: boolean }).standalone === true
    if (!isIOSStandalone) return

    let cancelled = false
    // Prevent iOS rubber-band from consuming the pull gesture
    const html = document.documentElement
    const prevOverscroll = html.style.overscrollBehaviorY
    html.style.overscrollBehaviorY = 'none'

    import('pulltorefreshjs').then((module) => {
      if (cancelled) return
      const PullToRefresh = module.default
      const ptr = PullToRefresh.init({
        mainElement: 'body',
        triggerElement: 'body',
        onRefresh: () => window.location.reload(),
        // iOS PWA overscroll can make scrollY go negative; be lenient. Skip when overlay open.
        shouldPullToRefresh: () => !isOverlayOpen() && window.scrollY <= 10,
        instructionsPullToRefresh: 'Pull down to refresh',
        instructionsReleaseToRefresh: 'Release to refresh',
        instructionsRefreshing: 'Refreshing…',
      })
      ptrRef.current = ptr
    })

    return () => {
      cancelled = true
      html.style.overscrollBehaviorY = prevOverscroll
      if (ptrRef.current) {
        ptrRef.current.destroy()
        ptrRef.current = null
      }
      import('pulltorefreshjs').then((m) => m.default.destroyAll())
    }
  }, [])

  return null
}
