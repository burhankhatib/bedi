import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { notifyDriversOfDeliveryOrder } from '@/lib/notify-drivers-for-order'
import { scheduleDeliveryLifecycleJobs } from '@/lib/delivery-job-scheduler'

/**
 * Sets deliveryRequestedAt, notifies drivers, schedules tier jobs.
 * Clears auto-delivery schedule field; sets autoDeliveryRequestTriggeredAt for cron/idempotency.
 */
export async function executeDeliveryRequestBroadcast(orderId: string): Promise<void> {
  if (!token) throw new Error('Sanity write token not configured')
  const writeClient = client.withConfig({ token, useCdn: false })
  const now = new Date().toISOString()
  const nowMs = new Date(now).getTime()
  await writeClient
    .patch(orderId)
    .set({
      deliveryRequestedAt: now,
      autoDeliveryRequestTriggeredAt: now,
    })
    .unset(['autoDeliveryRequestScheduledAt'])
    .commit()
  await notifyDriversOfDeliveryOrder(orderId)
  await scheduleDeliveryLifecycleJobs(orderId, nowMs)
}
