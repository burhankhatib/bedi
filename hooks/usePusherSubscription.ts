'use client'

import { useEffect, useRef, useState } from 'react'
import { getPusherClient, setPusherAuthParams } from '@/lib/pusher-client'

/**
 * Connection state mirroring Pusher's internal states.
 * 'live' is set after `pusher:subscription_succeeded` so components can render
 * a "Live" badge only when the channel is actually confirmed.
 */
export type PusherConnectionState = 'connecting' | 'live' | 'unavailable' | 'failed' | 'disconnected'

export type UsePusherSubscriptionOptions = {
  /** Skip subscribing when false (e.g. channel name not yet available). Default: true */
  enabled?: boolean
  /**
   * Extra params merged into the Pusher auth request before subscribing to a
   * private channel.  For the customer tracking page pass:
   *   { tracking_token: token, order_id: orderId }
   * Drivers don't need this — their Clerk session cookie is sent automatically.
   */
  authParams?: Record<string, string>
}

/**
 * Subscribes to a Pusher channel and binds to a single event.
 * Unlike `usePusherStream` (which triggers a refetch), this hook delivers
 * the event payload directly to the callback — ideal for data that should
 * update local state without a round-trip to Sanity (e.g. live driver GPS).
 *
 * @param channelName  e.g. `private-driver-location-abc123`
 * @param eventName    e.g. `location-update`
 * @param callback     Receives the parsed event data.  Wrap in useCallback to
 *                     prevent unnecessary re-subscribes.
 *
 * @returns `isLive` — true once Pusher confirms `pusher:subscription_succeeded`
 */
export function usePusherSubscription<TData = unknown>(
  channelName: string | null,
  eventName: string | null,
  callback: (data: TData) => void,
  options: UsePusherSubscriptionOptions = {}
): boolean {
  const { enabled = true, authParams } = options
  const callbackRef = useRef(callback)
  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  // Stringify auth params for stable useEffect dependency (avoids infinite loops
  // caused by object identity changing on every render).
  const authParamsKey = authParams ? JSON.stringify(authParams) : ''

  const [isLive, setIsLive] = useState(false)

  useEffect(() => {
    if (!enabled || !channelName || !eventName || typeof window === 'undefined') return

    const pusher = getPusherClient()
    if (!pusher) return

    // Merge auth params BEFORE subscribing so the auth endpoint gets them on
    // the very first attempt (important for private channels).
    if (authParams) {
      setPusherAuthParams(authParams)
    }

    setIsLive(false)

    const channel = pusher.subscribe(channelName)

    // Confirm the subscription is active before showing "Live"
    channel.bind('pusher:subscription_succeeded', () => {
      setIsLive(true)
    })

    // Subscription failed (e.g. auth rejected) — surface for debugging
    channel.bind('pusher:subscription_error', (err: unknown) => {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[pusher] subscription error on ${channelName}`, err)
      }
      setIsLive(false)
    })

    // Deliver event data directly to the callback — no Sanity round-trip needed
    const handler = (data: TData) => {
      callbackRef.current(data)
    }
    channel.bind(eventName, handler)

    return () => {
      channel.unbind(eventName, handler)
      channel.unbind('pusher:subscription_succeeded')
      channel.unbind('pusher:subscription_error')
      pusher.unsubscribe(channelName)
      setIsLive(false)
    }
    // authParamsKey is a stable string derived from authParams
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName, eventName, enabled, authParamsKey])

  return isLive
}
