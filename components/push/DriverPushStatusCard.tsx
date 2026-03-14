'use client'

import { PushStatusCard } from './PushStatusCard'
import { useDriverPush } from '@/app/(main)/driver/DriverPushContext'
import { getDriverPWAConfig } from '@/lib/pwa/configs'

export function DriverPushStatusCard() {
  const { hasPush, checked, loading, isDenied, needsIOSHomeScreen, subscribe, refreshToken } = useDriverPush()
  const status = !checked ? 'checking' : hasPush ? 'connected' : isDenied ? 'denied' : 'disconnected'
  return (
    <PushStatusCard
      variant="driver"
      status={status}
      loading={loading}
      isDenied={isDenied}
      needsIOSHomeScreen={needsIOSHomeScreen}
      onSubscribe={() => subscribe()}
      onRefresh={() => refreshToken()}
      pwaConfig={getDriverPWAConfig()}
    />
  )
}
