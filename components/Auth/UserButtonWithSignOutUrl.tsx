'use client'

import { UserButton } from '@clerk/nextjs'

/**
 * Renders Clerk UserButton with configurable afterSignOutUrl.
 * Default / so sign-out (customer/tenant/driver) lands on homepage.
 */
export function UserButtonWithSignOutUrl({ afterSignOutUrl = '/' }: { afterSignOutUrl?: string }) {
  return <UserButton afterSignOutUrl={afterSignOutUrl} />
}
