'use client'

import { useEffect, useRef } from 'react'
import { useDriverStatus } from './DriverStatusContext'

// Approx 50 meters in degrees
const MIN_DISTANCE_DEGREES = 0.0005

export function DriverLocationTracker() {
  const { isOnline } = useDriverStatus()
  const lastLocationRef = useRef<{ lat: number; lng: number } | null>(null)

  useEffect(() => {
    if (!isOnline) return

    const updateLocation = () => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) return

      const timeout = /samsung|android/i.test(navigator.userAgent) ? 25000 : 10000
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude
          const lng = position.coords.longitude
          const last = lastLocationRef.current

          // Only update if we don't have a last location or moved > ~50m
          if (
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
    }

    // Update on mount
    updateLocation()

    // Update on visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        updateLocation()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isOnline])

  return null
}
