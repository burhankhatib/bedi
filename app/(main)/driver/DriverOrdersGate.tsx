'use client'

/**
 * Non-blocking wrapper for driver content.
 * Never blocks interaction; DriverPushSetup (banner in layout) handles the Enable prompt.
 * FCM delivery unchanged: when the driver enables via the banner, the token is stored
 * via /api/driver/push-subscription and they receive new order alerts.
 */
export function DriverOrdersGate({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
