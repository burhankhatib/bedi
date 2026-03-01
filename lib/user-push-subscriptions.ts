import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'

export type RoleContext = 'customer' | 'driver' | 'tenant'

export type WebPushKeys = {
  endpoint: string
  p256dh: string
  auth: string
}

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

function normalizeToken(v: string | null | undefined): string {
  return (v ?? '').trim()
}

function normalizeDeviceInfo(v: string | null | undefined): string {
  const raw = (v ?? '').trim()
  return raw.slice(0, 400)
}

export async function upsertUserPushSubscription(input: {
  clerkUserId: string
  roleContext: RoleContext
  siteId?: string
  fcmToken?: string | null
  webPush?: WebPushKeys | null
  deviceInfo?: string | null
}): Promise<{ id: string; created: boolean } | null> {
  if (!token) return null
  const clerkUserId = normalizeToken(input.clerkUserId)
  const roleContext = input.roleContext
  const fcmToken = normalizeToken(input.fcmToken)
  const webPush = input.webPush
  const deviceInfo = normalizeDeviceInfo(input.deviceInfo)

  if (!clerkUserId || !roleContext) return null
  if (!fcmToken && !webPush?.endpoint) return null

  let existing: { _id: string } | null = null
  if (fcmToken) {
    existing = await writeClient.fetch<{ _id: string } | null>(
      `*[
        _type == "userPushSubscription" &&
        clerkUserId == $clerkUserId &&
        roleContext == $roleContext &&
        fcmToken == $fcmToken
      ][0]{ _id }`,
      { clerkUserId, roleContext, fcmToken }
    )
  } else if (webPush?.endpoint) {
    existing = await writeClient.fetch<{ _id: string } | null>(
      `*[
        _type == "userPushSubscription" &&
        clerkUserId == $clerkUserId &&
        roleContext == $roleContext &&
        webPush.endpoint == $endpoint
      ][0]{ _id }`,
      { clerkUserId, roleContext, endpoint: webPush.endpoint }
    )
  }

  const now = new Date().toISOString()
  const setPayload: Record<string, unknown> = {
    clerkUserId,
    roleContext,
    isActive: true,
    lastSeenAt: now,
  }
  if (input.siteId) {
    setPayload.site = { _type: 'reference', _ref: input.siteId }
  }
  if (fcmToken) setPayload.fcmToken = fcmToken
  if (webPush?.endpoint && webPush?.p256dh && webPush?.auth) {
    setPayload.webPush = {
      endpoint: webPush.endpoint,
      p256dh: webPush.p256dh,
      auth: webPush.auth,
    }
  }
  if (deviceInfo) setPayload.deviceInfo = deviceInfo

  if (existing?._id) {
    await writeClient.patch(existing._id).set(setPayload).unset(['lastError']).commit()
    return { id: existing._id, created: false }
  }

  const created = await writeClient.create({
    _type: 'userPushSubscription',
    ...setPayload,
    createdAt: now,
  })
  return { id: created._id, created: true }
}

export async function getActiveSubscriptionsForUser(input: {
  clerkUserId: string
  roleContext: RoleContext
}): Promise<Array<{ _id: string; fcmToken?: string; webPush?: WebPushKeys }>> {
  const clerkUserId = normalizeToken(input.clerkUserId)
  if (!clerkUserId) return []
  return writeClient.fetch<Array<{ _id: string; fcmToken?: string; webPush?: WebPushKeys }>>(
    `*[
      _type == "userPushSubscription" &&
      clerkUserId == $clerkUserId &&
      roleContext == $roleContext &&
      isActive != false
    ]{
      _id,
      fcmToken,
      "webPush": webPush
    }`,
    { clerkUserId, roleContext: input.roleContext }
  )
}

export async function markSubscriptionInactive(input: {
  id: string
  reason?: string
}): Promise<void> {
  if (!input.id) return
  await writeClient
    .patch(input.id)
    .set({
      isActive: false,
      lastError: input.reason || 'inactive',
      lastSeenAt: new Date().toISOString(),
    })
    .commit()
}
