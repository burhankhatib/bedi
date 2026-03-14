'use client'

/**
 * FCM check runs in background. We only show a prompt when we know push is disabled.
 * No banner while checking. Use the bottom PushStatusCard for status & actions.
 */
import { usePathname } from 'next/navigation'
import { useTenantPush } from './TenantPushContext'

export function TenantOrdersGate({ slug, children }: { slug: string; children: React.ReactNode }) {
  const pathname = usePathname()
  const { hasPush, checked } = useTenantPush()

  const ordersPath = `/t/${slug}/orders`
  const isOnOrdersPage = pathname === ordersPath

  // No banner: status and enable/refresh live in PushStatusCard at bottom
  if (!isOnOrdersPage || hasPush || !checked) return <>{children}</>

  return <>{children}</>
}
