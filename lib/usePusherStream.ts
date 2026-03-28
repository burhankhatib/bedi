'use client'

import { useEffect, useRef } from 'react'
import { getPusherClient } from './pusher-client'
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'

export type UsePusherStreamOptions = {
  /** When set, multiple events in quick succession trigger at most one onUpdate (last one) after the delay. */
  debounceMs?: number
}

/**
 * Subscribes to a Pusher channel and event.
 * Calls onUpdate whenever the server sends an event.
 * If debounceMs is set, rapid events result in a single onUpdate after the delay.
 */
export function usePusherStream(
  channelName: string | null,
  eventName: string | null,
  onUpdate: () => void,
  options?: UsePusherStreamOptions
) {
  const onUpdateRef = useRef(onUpdate)
  useEffect(() => {
    onUpdateRef.current = onUpdate
  }, [onUpdate])
  const debounceMs = options?.debounceMs ?? 0
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!channelName || !eventName || typeof window === 'undefined') return

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

    const pusher = getPusherClient()
    if (!pusher) return

    const channel = pusher.subscribe(channelName)
    channel.bind(eventName, trigger)

    // In Capacitor, if the app was suspended, we might miss real-time events.
    // Trigger a refetch when returning to the foreground just in case.
    let resumeListener: Promise<{ remove: () => Promise<void> }> | null = null
    if (Capacitor.isNativePlatform()) {
      try {
        resumeListener = App.addListener('appStateChange', ({ isActive }) => {
          if (isActive) trigger()
        })
      } catch {
        resumeListener = null
      }
    }

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      channel.unbind(eventName, trigger)
      pusher.unsubscribe(channelName)
      if (resumeListener) {
        resumeListener.then((sub) => sub.remove()).catch(() => {})
      }
    }
  }, [channelName, eventName, debounceMs])
}
