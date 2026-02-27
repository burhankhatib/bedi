import { client } from '@/sanity/lib/client'
import { ANALYTICS_QUERY } from '@/sanity/lib/queries'
import { AnalyticsClient } from './AnalyticsClient'

// Force dynamic rendering to ensure SanityLive works
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AnalyticsPage() {
  let orders = []

  try {
    orders = (await client.fetch(ANALYTICS_QUERY)) ?? []
  } catch (error) {
    console.error('[Analytics] Failed to fetch orders:', error)
    orders = []
  }

  return <AnalyticsClient initialOrders={orders} />
}
