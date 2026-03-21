'use client'

import { OrderTrackView } from '@/components/tracking/OrderTrackView'

export function OrderTrackClient({ slug, token }: { slug: string; token: string }) {
  return <OrderTrackView slug={slug} token={token} />
}
