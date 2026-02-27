'use client'

import { TenantPushProvider } from './TenantPushContext'
import { TenantOrdersGate } from './TenantOrdersGate'

/**
 * Wraps manage content with push context and orders gate.
 * On the Orders page, tenant must enable notifications (same as driver) to receive push when app is closed.
 */
export function TenantManagePushWrapper({
  slug,
  children,
}: {
  slug: string
  children: React.ReactNode
}) {
  return (
    <TenantPushProvider slug={slug} scope={`/t/${slug}/manage`}>
      <TenantOrdersGate slug={slug}>
        {children}
      </TenantOrdersGate>
    </TenantPushProvider>
  )
}
