'use client'

import { useEffect, useRef } from 'react'
import { useDriverPush } from './DriverPushContext'
import { useDriverStatus } from './DriverStatusContext'

const OFFLINE_PUSH_SENT_KEY = 'driverOfflinePushSent'
const OFFLINE_REMINDER_DELAY_MS = 30 * 1000 // 30 seconds

/**
 * When the driver opens the PWA and is offline (with push enabled), wait 30 seconds
 * then send one reminder per session: "You receive orders only when online. Go online to get delivery requests."
 */
export function DriverStatusPushReminder() {
  const { hasPush } = useDriverPush()
  const { isOnline } = useDriverStatus()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || !hasPush || isOnline) return
    try {
      if (sessionStorage.getItem(OFFLINE_PUSH_SENT_KEY)) return
    } catch {
      return
    }

    timerRef.current = setTimeout(() => {
      timerRef.current = null
      try {
        if (sessionStorage.getItem(OFFLINE_PUSH_SENT_KEY)) return
        sessionStorage.setItem(OFFLINE_PUSH_SENT_KEY, '1')
        fetch('/api/driver/push-send-offline-reminder', { method: 'POST' }).catch(() => {})
      } catch {
        // sessionStorage can throw in private mode
      }
    }, OFFLINE_REMINDER_DELAY_MS)

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [hasPush, isOnline])

  return null
}
