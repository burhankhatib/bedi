'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useDriverStatus } from './DriverStatusContext'
import { usePusherSubscription } from '@/hooks/usePusherSubscription'

// Approx 50 meters in degrees
const MIN_DISTANCE_DEGREES = 0.0005
const PERIODIC_PING_INTERVAL_MS = 90_000 // 90 seconds

export function DriverLocationTracker() {
  const { isOnline } = useDriverStatus()
  const lastLocationRef = useRef<{ lat: number; lng: number } | null>(null)

  const sendLocation = useCallback((forced = false) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return

    const timeout = /samsung|android/i.test(navigator.userAgent) ? 25000 : 10000
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude
        const lng = position.coords.longitude
        const last = lastLocationRef.current

        // Update if forced, OR if we don't have a last location, OR moved > ~50m
        if (
          forced ||
          !last ||
          Math.abs(last.lat - lat) > MIN_DISTANCE_DEGREES ||
          Math.abs(last.lng - lng) > MIN_DISTANCE_DEGREES
        ) {
          lastLocationRef.current = { lat, lng }
          fetch('/api/driver/location', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lat, lng }),
          }).catch(() => {}) // Silent fail
        }
      },
      () => {
        // Silent fail on geolocation error
      },
      { enableHighAccuracy: true, timeout, maximumAge: 0 }
    )
  }, [])

  useEffect(() => {
    if (!isOnline) return

    // 1. Update immediately on mount
    sendLocation(true)

    // 2. Update on visibility change (coming back to the app)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        sendLocation(true)
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // 3. Periodic ping to ensure lastLocationAt stays fresh even if stationary
    const intervalId = setInterval(() => {
      sendLocation(true)
    }, PERIODIC_PING_INTERVAL_MS)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      clearInterval(intervalId)
    }
  }, [isOnline, sendLocation])

  // 4. Listen for 'refresh-location' from Pusher (triggered when a new delivery is requested)
  // This ensures all online drivers submit a fresh location exactly when a tier dispatch is starting.
  usePusherSubscription(
    'private-driver-global',
    'refresh-location',
    useCallback(() => {
      if (isOnline) {
        sendLocation(true)
      }
    }, [isOnline, sendLocation]),
    { enabled: isOnline }
  )

  return null
}
