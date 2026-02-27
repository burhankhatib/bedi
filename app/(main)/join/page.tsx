import { getHomePageStats } from '@/lib/home-stats'
import { JoinPageClient } from './JoinPageClient'

export const dynamic = 'force-dynamic'

/**
 * /join - Info and sign-up for tenants and drivers. Available to everyone (signed in or not).
 */
export default async function JoinPage() {
  const stats = await getHomePageStats()
  return <JoinPageClient stats={stats} />
}