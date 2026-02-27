'use client'

import { useEffect, useRef } from 'react'

export type UseSanityLiveStreamOptions = {
  /** When set, multiple events in quick succession trigger at most one onUpdate (last one) after the delay. */
  debounceMs?: number
}

/**
 * Opens an SSE stream to the given URL (same-origin; cookies sent for auth).
 * Calls onUpdate whenever the server sends an event. Reconnects on close with backoff.
 * If debounceMs is set, rapid events result in a single onUpdate after the delay.
 */
export function useSanityLiveStream(
  url: string | null,
  onUpdate: () => void,
  options?: UseSanityLiveStreamOptions
) {
  const onUpdateRef = useRef(onUpdate)
  onUpdateRef.current = onUpdate
  const debounceMs = options?.debounceMs ?? 0
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!url || typeof window === 'undefined') return
    let es: EventSource | null = null
    let reconnectTimeout: ReturnType<typeof setTimeout>
    let delay = 1000
    const maxDelay = 30000

    const trigger = () => {
      if (debounceMs > 0) {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => {
          debounceRef.current = null
          onUpdateRef.current()
        }, debounceMs)
      } else {
        onUpdateRef.current()
      }
    }

    const connect = () => {
      try {
        es = new EventSource(url)
        es.onmessage = () => {
          delay = 1000
          trigger()
        }
        es.onerror = () => {
          es?.close()
          es = null
          reconnectTimeout = setTimeout(() => {
            delay = Math.min(delay * 1.5, maxDelay)
            connect()
          }, delay)
        }
      } catch {
        reconnectTimeout = setTimeout(connect, delay)
      }
    }
    connect()
    return () => {
      clearTimeout(reconnectTimeout)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      es?.close()
    }
  }, [url, debounceMs])
}
