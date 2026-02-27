/**
 * Send push (FCM + Web Push) to the tenant (owner) and all staff members.
 * Used for new orders, table requests (Help/Pay), and order status updates.
 */

import { client } from '@/sanity/lib/client'
import { sendPushNotification, isPushConfigured } from '@/lib/push'
import { sendFCMToToken, isFCMConfigured } from '@/lib/fcm'

export type TenantPushPayload = { title: string; body: string; url: string }

async function sendToTokensAndSubscription(
  payload: TenantPushPayload,
  fcmTokens: string[],
  pushSubscription: { endpoint: string; p256dh: string; auth: string } | null
): Promise<boolean> {
  let sent = false
  if (isFCMConfigured() && fcmTokens.length > 0) {
    for (const tok of fcmTokens) {
      const ok = await sendFCMToToken(tok, payload)
      if (ok) sent = true
    }
  }
  if (pushSubscription?.endpoint && pushSubscription?.p256dh && pushSubscription?.auth && isPushConfigured()) {
    const ok = await sendPushNotification(
      { endpoint: pushSubscription.endpoint, keys: { p256dh: pushSubscription.p256dh, auth: pushSubscription.auth } },
      payload
    )
    if (ok) sent = true
  }
  return sent
}

/**
 * Send payload to tenant (owner) and all staff for this tenant. Each gets their own FCM/Web Push.
 */
export async function sendTenantAndStaffPush(
  tenantId: string,
  payload: TenantPushPayload
): Promise<boolean> {
  if (!isFCMConfigured() && !isPushConfigured()) return false

  const tenant = await client.fetch<{
    fcmToken?: string
    fcmTokens?: string[]
    pushSubscription?: { endpoint?: string; p256dh?: string; auth?: string }
  } | null>(
    `*[_type == "tenant" && _id == $id][0]{ fcmToken, fcmTokens, "pushSubscription": pushSubscription }`,
    { id: tenantId }
  )
  const staffList = await client.fetch<
    Array<{
      fcmTokens?: string[]
      pushSubscription?: { endpoint?: string; p256dh?: string; auth?: string }
    }>
  >(
    `*[_type == "tenantStaff" && site._ref == $tenantId]{ fcmTokens, "pushSubscription": pushSubscription }`,
    { tenantId }
  )

  const tenantFcm = [...new Set((tenant?.fcmTokens ?? []).concat(tenant?.fcmToken ? [tenant.fcmToken] : []))].filter(Boolean)
  const tenantSub = tenant?.pushSubscription?.endpoint && tenant?.pushSubscription?.p256dh && tenant?.pushSubscription?.auth
    ? { endpoint: tenant.pushSubscription.endpoint, p256dh: tenant.pushSubscription.p256dh, auth: tenant.pushSubscription.auth }
    : null

  let sent = await sendToTokensAndSubscription(payload, tenantFcm, tenantSub)

  for (const staff of staffList ?? []) {
    const staffFcm = staff.fcmTokens ?? []
    const staffSub = staff.pushSubscription?.endpoint && staff.pushSubscription?.p256dh && staff.pushSubscription?.auth
      ? { endpoint: staff.pushSubscription.endpoint, p256dh: staff.pushSubscription.p256dh, auth: staff.pushSubscription.auth }
      : null
    const ok = await sendToTokensAndSubscription(payload, staffFcm, staffSub)
    if (ok) sent = true
  }

  return sent
}
