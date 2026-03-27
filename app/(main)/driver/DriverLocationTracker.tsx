'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useDriverStatus } from './DriverStatusContext'
import { usePusherSubscription } from '@/hooks/usePusherSubscription'
import { getDeviceGeolocationPosition, isDeviceGeolocationSupported, watchDeviceGeolocation, clearDeviceGeolocationWatch, WatchGeolocationId } from '@/lib/device-geolocation'

// Approx 50 meters in degrees
const MIN_DISTANCE_DEGREES = 0.0005
const PERIODIC_PING_INTERVAL_MS = 90_000 // 90 seconds

/** Stop early when the OS reports this accuracy (meters) or better. */
const GOOD_ACCURACY_M = 25
/** Let GPS refine — first callback is often Wi‑Fi/cell (hundreds of m to km off). */
const REFINE_WINDOW_MS = /samsung|android/i.test(
  typeof navigator !== 'undefined' ? navigator.userAgent : '',
)
  ? 18_000
  : 10_000

/**
 * Sample positions for a short window and use the best reported accuracy.
 * Matches the pattern in OrderTrackView (customer share) — single getCurrentPosition
 * often returns a fast coarse fix before GPS converges.
 */
function getRefinedPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!isDeviceGeolocationSupported()) {
      reject(new Error('Geolocation is not available'))
      return
    }

    let best: { coords: { latitude: number; longitude: number; accuracy: number | null } } | null = null
    let watchIdPromise: Promise<WatchGeolocationId> | null = null
    // Browser timers are numeric handles; avoid NodeJS.Timeout from DOM/global setTimeout overloads.
    let timeoutId: number | null = null
    let settled = false

    const cleanupWatch = async () => {
      if (watchIdPromise !== null) {
        const id = await watchIdPromise
        clearDeviceGeolocationWatch(id)
        watchIdPromise = null
      }
    }

    const finish = (pos: { coords: { latitude: number; longitude: number; accuracy: number | null } }) => {
      if (settled) return
      settled = true
      cleanupWatch()
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
        timeoutId = null
      }
      resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude })
    }

    const onPosition = (pos: { latitude: number; longitude: number; accuracy?: number | null }) => {
      const p = { coords: { latitude: pos.latitude, longitude: pos.longitude, accuracy: pos.accuracy ?? null } }
      const acc = p.coords.accuracy ?? Infinity
      const bestAcc = best?.coords?.accuracy ?? Infinity
      if (!best || acc < bestAcc) best = p
      if (acc <= GOOD_ACCURACY_M) finish(p)
    }

    const onError = (err: unknown) => {
      if (best) {
        finish(best)
        return
      }
      if (settled) return
      settled = true
      cleanupWatch()
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
        timeoutId = null
      }
      reject(err)
    }

    watchIdPromise = watchDeviceGeolocation(onPosition, onError, {
      enableHighAccuracy: true,
      maximumAge: 0,
    }).catch(err => {
      onError(err)
      return '' as WatchGeolocationId
    })

    timeoutId = window.setTimeout(() => {
      if (settled) return
      if (best) {
        finish(best)
        return
      }
      cleanupWatch()
      const isSamsungLike = /samsung|android/i.test(typeof navigator !== 'undefined' ? navigator.userAgent : '')
      getDeviceGeolocationPosition({
        enableHighAccuracy: true,
        timeout: isSamsungLike ? 8000 : 5000,
        maximumAge: 0,
      }).then(pos => {
        finish({ coords: { latitude: pos.latitude, longitude: pos.longitude, accuracy: pos.accuracy ?? null } })
      }).catch(err => {
        if (settled) return
        settled = true
        if (timeoutId !== null) {
          window.clearTimeout(timeoutId)
          timeoutId = null
        }
        reject(new Error('Geolocation timeout'))
      })
    }, REFINE_WINDOW_MS)
  })
}

export function DriverLocationTracker() {
  const { isOnline } = useDriverStatus()
  const lastLocationRef = useRef<{ lat: number; lng: number } | null>(null)
  const inFlightRef = useRef(false)
  const rerunAfterFlightRef = useRef(false)

  const sendLocation = useCallback((forced = false) => {
    if (!isDeviceGeolocationSupported()) return

    const run = () => {
      inFlightRef.current = true
      getRefinedPosition()
        .then((position) => {
          const lat = position.lat
          const lng = position.lng
          const last = lastLocationRef.current

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
            }).catch(() => {})
          }
        })
        .catch(() => {
          // Silent fail on geolocation error
        })
        .finally(() => {
          inFlightRef.current = false
          if (rerunAfterFlightRef.current) {
            rerunAfterFlightRef.current = false
            run()
          }
        })
    }

    if (inFlightRef.current) {
      if (forced) rerunAfterFlightRef.current = true
      return
    }
    run()
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
