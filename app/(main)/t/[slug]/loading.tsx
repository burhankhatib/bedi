import { TenantPageSkeleton } from '@/components/loading'

/**
 * Shown when navigating to /t/[slug].
 * Matches MenuLayout structure so users see what's loading.
 */
export default function TenantLoading() {
  return <TenantPageSkeleton />
}
