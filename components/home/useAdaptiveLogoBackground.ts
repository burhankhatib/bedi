'use client'

import { useState, useEffect, useRef } from 'react'
import { extractAverageLogoColorFromUrl } from '@/lib/image/extractAverageLogoColor'

/** Bump when sampling logic changes (invalidates old sessionStorage entries). */
const CACHE_PREFIX = 'bedi-logo-bg:v3:'
/** Cached decision: logo treated as transparent / keep white — avoids re-decoding. */
const CACHE_TRANSPARENT = '__transparent__'

function readCachedColor(url: string): string | null {
  try {
    const v = sessionStorage.getItem(CACHE_PREFIX + url)
    if (!v || v === CACHE_TRANSPARENT) return null
    return v
  } catch {
    return null
  }
}

function isCachedTransparent(url: string): boolean {
  try {
    return sessionStorage.getItem(CACHE_PREFIX + url) === CACHE_TRANSPARENT
  } catch {
    return false
  }
}

function writeSolid(url: string, color: string) {
  try {
    sessionStorage.setItem(CACHE_PREFIX + url, color)
  } catch {
    /* quota / private mode */
  }
}

function writeTransparent(url: string) {
  try {
    sessionStorage.setItem(CACHE_PREFIX + url, CACHE_TRANSPARENT)
  } catch {
    /* ignore */
  }
}

/**
 * Deferred logo-tile background: in-view + idle, cached, capped concurrency (see lib).
 * No extra API calls; falls back to null → caller keeps default (e.g. white).
 */
export function useAdaptiveLogoBackground(logoUrl: string | null | undefined) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [backgroundColor, setBackgroundColor] = useState<string | null>(() =>
    logoUrl ? readCachedColor(logoUrl) : null
  )

  useEffect(() => {
    if (!logoUrl) {
      setBackgroundColor(null)
      return
    }
    setBackgroundColor(readCachedColor(logoUrl))
  }, [logoUrl])

  useEffect(() => {
    if (!logoUrl) return
    if (readCachedColor(logoUrl)) return
    if (isCachedTransparent(logoUrl)) return

    const ac = new AbortController()
    const root = containerRef.current
    if (!root) return

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return
        io.disconnect()

        const run = () => {
          if (ac.signal.aborted) return
          void extractAverageLogoColorFromUrl(logoUrl, ac.signal).then((result) => {
            if (ac.signal.aborted) return
            if (result.kind === 'solid') {
              writeSolid(logoUrl, result.color)
              setBackgroundColor(result.color)
              return
            }
            if (result.kind === 'transparent') {
              writeTransparent(logoUrl)
              return
            }
            /* failed: don’t cache — may retry on next visit */
          })
        }

        if (typeof requestIdleCallback !== 'undefined') {
          requestIdleCallback(run, { timeout: 2800 })
        } else {
          window.setTimeout(run, 120)
        }
      },
      { rootMargin: '120px', threshold: 0.01 }
    )

    io.observe(root)
    return () => {
      ac.abort()
      io.disconnect()
    }
  }, [logoUrl])

  return { containerRef, backgroundColor }
}
