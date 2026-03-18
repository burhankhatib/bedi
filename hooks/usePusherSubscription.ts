'use client'

import { useEffect, useRef, useState } from 'react'
import { getPusherClient } from '@/lib/pusher-client'

/**
 * Connection state mirroring Pusher's internal states.
 * 'live' is set after `pusher:subscription_succeeded` so components can render
 * a "Live" badge only when the channel is actually confirmed.
 */
export type PusherConnectionState = 'connecting' | 'live' | 'unavailable' | 'failed' | 'disconnected'

export type UsePusherSubscriptionOptions = {
  /** Skip subscribing when false (e.g. channel name not yet available). Default: true */
  enabled?: boolean
}

/**
 * Subscribes to a Pusher channel and binds to a single event.
 * Unlike `usePusherStream` (which triggers a refetch), this hook delivers
 * the event payload directly to the callback — ideal for data that should
 * update local state without a round-trip to Sanity (e.g. live driver GPS).
 *
 * @param channelName  e.g. `driver-location-abc123`
 * @param eventName    e.g. `location-update`
 * @param callback     Receives the parsed event data.  Wrap in useCallback to
 *                     prevent unnecessary re-subscribes.
 *
 * @returns `isLive` — true once Pusher confirms `pusher:subscription_succeeded`
 *
 * @example
 * const isLive = usePusherSubscription(
 *   `driver-location-${orderId}`,
 *   'location-update',
 *   useCallback((coords: { lat: number; lng: number }) => {
 *     setDriverLocation(coords)
 *   }, [])
 * )
 */
export function usePusherSubscription<TData = unknown>(
  channelName: string | null,
  eventName: string | null,
  callback: (data: TData) => void,
  options: UsePusherSubscriptionOptions = {}
): boolean {
  const { enabled = true } = options
  const callbackRef = useRef(callback)
  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  const [isLive, setIsLive] = useState(false)

  useEffect(() => {
    if (!enabled || !channelName || !eventName || typeof window === 'undefined') return

    const pusher = getPusherClient()
    if (!pusher) return

    setIsLive(false)

    const channel = pusher.subscribe(channelName)

    // Confirm the subscription is active before showing "Live"
    channel.bind('pusher:subscription_succeeded', () => {
      setIsLive(true)
    })

    // Deliver event data directly to the callback — no Sanity round-trip needed
    const handler = (data: TData) => {
      callbackRef.current(data)
    }
    channel.bind(eventName, handler)

    return () => {
      channel.unbind(eventName, handler)
      channel.unbind('pusher:subscription_succeeded')
      pusher.unsubscribe(channelName)
      setIsLive(false)
    }
  }, [channelName, eventName, enabled])

  return isLive
}
