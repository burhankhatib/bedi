import { pusherServer, triggerPusherEvent } from '@/lib/pusher'
import { RatingAggregate } from './types'

export async function publishRatingSubmitted(targetRole: string, targetId: string) {
  const channel = `rating-${targetRole}-${targetId}`
  await triggerPusherEvent(channel, 'rating-submitted', { targetId })
}

export async function publishRatingAggregateUpdated(aggregate: RatingAggregate) {
  const channel = `rating-${aggregate.targetRole}-${aggregate.id}`
  await triggerPusherEvent(channel, 'aggregate-updated', aggregate as unknown as Record<string, unknown>)
}
