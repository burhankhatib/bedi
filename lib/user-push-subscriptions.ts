import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { randomBytes } from 'crypto'

export type RoleContext = 'customer' | 'driver' | 'tenant'

export type WebPushKeys = {
  endpoint: string
  p256dh: string
  auth: string
}

export type PushDevice = {
  _key: string
  fcmToken?: string
  webPush?: WebPushKeys
  deviceInfo?: string
  lastRefreshedAt: string
  lastError?: string
}

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

function normalizeToken(v: string | null | undefined): string {
  return (v ?? '').trim()
}

function normalizeDeviceInfo(v: string | null | undefined): string {
  const raw = (v ?? '').trim()
  return raw.slice(0, 400)
}

function generateKey(input: string): string {
  // Simple deterministic or random key based on token
  // A quick hash would be best, but randomBytes is easier if we just match by value.
  // Actually Sanity _key needs to be unique and valid. Let's just use a random hex.
  return randomBytes(8).toString('hex')
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

  const now = new Date().toISOString()

  // 1. Fetch existing documents for this user + role
  const existingDocs = await writeClient.fetch<any[]>(
    `*[
      _type == "userPushSubscription" &&
      clerkUserId == $clerkUserId &&
      roleContext == $roleContext
    ] | order(_createdAt asc)`,
    { clerkUserId, roleContext }
  )

  let mainDoc = existingDocs.find(doc => Array.isArray(doc.devices))
  
  // Migration logic: If there are legacy docs (no devices array), we'll consolidate them into the main doc
  const legacyDocs = existingDocs.filter(doc => !Array.isArray(doc.devices) && (doc.fcmToken || doc.webPush))

  if (!mainDoc && legacyDocs.length > 0) {
    mainDoc = legacyDocs[0]
  }

  const newDevice: PushDevice = {
    _key: generateKey(fcmToken || webPush?.endpoint || now),
    lastRefreshedAt: now,
  }
  if (fcmToken) newDevice.fcmToken = fcmToken
  if (webPush) newDevice.webPush = webPush
  if (deviceInfo) newDevice.deviceInfo = deviceInfo

  if (mainDoc) {
    // Consolidate legacy docs
    let devices = Array.isArray(mainDoc.devices) ? [...mainDoc.devices] : []
    
    // Add legacy tokens to devices array if not already present
    for (const legacy of legacyDocs) {
      if (legacy.fcmToken && !devices.some((d: any) => d.fcmToken === legacy.fcmToken)) {
        devices.push({
          _key: generateKey(legacy.fcmToken),
          fcmToken: legacy.fcmToken,
          lastRefreshedAt: legacy.lastSeenAt || now,
        })
      }
      if (legacy.webPush?.endpoint && !devices.some((d: any) => d.webPush?.endpoint === legacy.webPush.endpoint)) {
        devices.push({
          _key: generateKey(legacy.webPush.endpoint),
          webPush: legacy.webPush,
          lastRefreshedAt: legacy.lastSeenAt || now,
        })
      }
    }

    // Upsert current device
    const existingDeviceIndex = devices.findIndex((d: any) => 
      (fcmToken && d.fcmToken === fcmToken) || 
      (webPush && d.webPush?.endpoint === webPush.endpoint)
    )

    if (existingDeviceIndex >= 0) {
      devices[existingDeviceIndex] = {
        ...devices[existingDeviceIndex],
        ...newDevice,
        _key: devices[existingDeviceIndex]._key, // preserve key
      }
    } else {
      devices.push(newDevice)
    }

    const sites = Array.isArray(mainDoc.sites) ? [...mainDoc.sites] : []
    if (input.siteId && !sites.some((s: any) => s._ref === input.siteId)) {
      sites.push({ _type: 'reference', _ref: input.siteId, _key: generateKey(input.siteId) })
    }

    const transaction = writeClient.transaction()
    
    transaction.patch(mainDoc._id, p => p.set({ 
      devices, 
      sites, 
      isActive: true, 
      lastSeenAt: now 
    }).unset(['fcmToken', 'webPush', 'lastError', 'site'])) // Clean up legacy fields

    // Delete other legacy docs
    for (const legacy of legacyDocs) {
      if (legacy._id !== mainDoc._id) {
        transaction.delete(legacy._id)
      }
    }

    await transaction.commit()
    return { id: mainDoc._id, created: false }
  }

  // Create new document
  const sites = input.siteId ? [{ _type: 'reference', _ref: input.siteId, _key: generateKey(input.siteId) }] : []
  
  const created = await writeClient.create({
    _type: 'userPushSubscription',
    clerkUserId,
    roleContext,
    devices: [newDevice],
    sites,
    isActive: true,
    createdAt: now,
    lastSeenAt: now,
  })

  return { id: created._id, created: true }
}

export async function getActiveSubscriptionsForUser(input: {
  clerkUserId: string
  roleContext: RoleContext
}): Promise<any[]> {
  const clerkUserId = normalizeToken(input.clerkUserId)
  if (!clerkUserId) return []
  // This now returns the consolidated doc
  return writeClient.fetch<any[]>(
    `*[
      _type == "userPushSubscription" &&
      clerkUserId == $clerkUserId &&
      roleContext == $roleContext &&
      isActive != false
    ]{
      _id,
      devices
    }`,
    { clerkUserId, roleContext: input.roleContext }
  )
}

export async function removeDevice(input: {
  clerkUserId: string
  roleContext: RoleContext
  fcmToken?: string
  endpoint?: string
}): Promise<void> {
  const { clerkUserId, roleContext, fcmToken, endpoint } = input
  if (!clerkUserId || !roleContext) return
  if (!fcmToken && !endpoint) return

  const docs = await writeClient.fetch<any[]>(
    `*[
      _type == "userPushSubscription" &&
      clerkUserId == $clerkUserId &&
      roleContext == $roleContext
    ]`,
    { clerkUserId, roleContext }
  )

  for (const doc of docs) {
    if (!Array.isArray(doc.devices)) continue
    const filteredDevices = doc.devices.filter((d: any) => {
      if (fcmToken && d.fcmToken === fcmToken) return false
      if (endpoint && d.webPush?.endpoint === endpoint) return false
      return true
    })

    if (filteredDevices.length < doc.devices.length) {
      await writeClient.patch(doc._id)
        .set({ devices: filteredDevices })
        .commit()
    }
  }
}

export async function checkDeviceToken(input: {
  clerkUserId: string
  roleContext: RoleContext
  fcmToken?: string
  endpoint?: string
}): Promise<{ status: 'ok' | 'refreshed' | 'not_found', docId?: string } | null> {
  const { clerkUserId, roleContext, fcmToken, endpoint } = input
  if (!clerkUserId || !roleContext) return null
  if (!fcmToken && !endpoint) return null

  const doc = await writeClient.fetch<any>(
    `*[
      _type == "userPushSubscription" &&
      clerkUserId == $clerkUserId &&
      roleContext == $roleContext
    ][0]`,
    { clerkUserId, roleContext }
  )

  if (!doc || !Array.isArray(doc.devices)) {
    return { status: 'not_found' }
  }

  const deviceIndex = doc.devices.findIndex((d: any) => {
    if (fcmToken && d.fcmToken === fcmToken) return true
    if (endpoint && d.webPush?.endpoint === endpoint) return true
    return false
  })

  if (deviceIndex === -1) {
    return { status: 'not_found', docId: doc._id }
  }

  const device = doc.devices[deviceIndex]
  const lastRefreshed = device.lastRefreshedAt ? new Date(device.lastRefreshedAt).getTime() : 0
  const now = Date.now()
  const twentyFourHours = 24 * 60 * 60 * 1000

  if (now - lastRefreshed > twentyFourHours) {
    // Update lastRefreshedAt
    const devices = [...doc.devices]
    devices[deviceIndex] = { ...device, lastRefreshedAt: new Date().toISOString() }
    await writeClient.patch(doc._id)
      .set({ devices })
      .commit()
    return { status: 'refreshed', docId: doc._id }
  }

  return { status: 'ok', docId: doc._id }
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
      lastSeenAt: new Date().toISOString(),
    })
    .commit()
}
