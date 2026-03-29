/**
 * TableSession: persisted in Redis alongside the shared cart.
 * Tracks which devices have joined a dine-in table group order,
 * who is the leader, and the overall session status.
 *
 * Leader = first device to join; auto-promoted to next member if leader leaves.
 * TTL: 4 hours, refreshed on every write.
 */

import { redis } from '@/lib/redis'

export type SessionRole = 'leader' | 'member'

export type TableSessionMember = {
  deviceId: string
  displayName: string
  role: SessionRole
  joinedAt: string
}

export type TableSessionStatus = 'active' | 'ordered' | 'closed'

export type TableSession = {
  sessionId: string
  tenantSlug: string
  tableNumber: string
  status: TableSessionStatus
  leaderDeviceId: string
  members: TableSessionMember[]
  trackingToken?: string | null
  participantsCount?: number
  createdAt: string
  updatedAt: string
}

/** Redis session TTL: 4 hours (aligned with cart TTL). */
const SESSION_TTL_SECONDS = 14_400

export function buildSessionKey(slug: string, tableNumber: string): string {
  return `session:${slug}:${tableNumber}`
}

export async function getTableSession(
  slug: string,
  tableNumber: string
): Promise<TableSession | null> {
  if (!redis) return null
  try {
    return await redis.get<TableSession>(buildSessionKey(slug, tableNumber))
  } catch {
    return null
  }
}

export async function saveTableSession(session: TableSession): Promise<void> {
  if (!redis) return
  session.updatedAt = new Date().toISOString()
  await redis.setex(
    buildSessionKey(session.tenantSlug, session.tableNumber),
    SESSION_TTL_SECONDS,
    session
  )
}

export async function clearTableSession(
  slug: string,
  tableNumber: string
): Promise<void> {
  if (!redis) return
  try {
    await redis.del(buildSessionKey(slug, tableNumber))
  } catch {
    /* ignore */
  }
}

export function createNewTableSession(
  slug: string,
  tableNumber: string,
  leader: { deviceId: string; displayName: string }
): TableSession {
  const now = new Date().toISOString()
  return {
    sessionId: `${slug}-${tableNumber}-${Date.now()}`,
    tenantSlug: slug,
    tableNumber,
    status: 'active',
    leaderDeviceId: leader.deviceId,
    members: [
      {
        deviceId: leader.deviceId,
        displayName: leader.displayName,
        role: 'leader',
        joinedAt: now,
      },
    ],
    createdAt: now,
    updatedAt: now,
  }
}

export function isSessionLeader(
  session: TableSession | null,
  deviceId: string
): boolean {
  if (!session) return false
  return session.leaderDeviceId === deviceId
}

/** Add new member or update existing member's display name. */
export function upsertSessionMember(
  session: TableSession,
  deviceId: string,
  displayName: string
): TableSession {
  const existing = session.members.find((m) => m.deviceId === deviceId)
  if (existing) {
    return {
      ...session,
      members: session.members.map((m) =>
        m.deviceId === deviceId ? { ...m, displayName } : m
      ),
    }
  }
  return {
    ...session,
    members: [
      ...session.members,
      {
        deviceId,
        displayName,
        role: 'member',
        joinedAt: new Date().toISOString(),
      },
    ],
  }
}

/** Remove member; auto-promote next member to leader if they were leader. */
export function removeSessionMember(
  session: TableSession,
  deviceId: string
): TableSession {
  const remaining = session.members.filter((m) => m.deviceId !== deviceId)
  if (remaining.length === 0) {
    return { ...session, members: [] }
  }
  if (session.leaderDeviceId !== deviceId) {
    return { ...session, members: remaining }
  }
  // Promote first remaining member to leader
  const newLeaderId = remaining[0].deviceId
  return {
    ...session,
    leaderDeviceId: newLeaderId,
    members: remaining.map((m) =>
      m.deviceId === newLeaderId ? { ...m, role: 'leader' as const } : m
    ),
  }
}

/** Minimal session state safe to broadcast via Pusher (excludes timing internals). */
export function toSessionSummary(session: TableSession) {
  return {
    leaderDeviceId: session.leaderDeviceId,
    members: session.members,
    participantsCount: session.members.length,
    status: session.status,
  }
}
