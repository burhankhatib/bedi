'use client'

import { OrderTrackView } from '@/components/tracking/OrderTrackView'

export function OrderTrackClient({ slug, orderId }: { slug: string; orderId: string }) {
  return <OrderTrackView slug={slug} orderId={orderId} />
}
