import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { isSuperAdminEmail } from '@/lib/constants'
import { getEmailForUser } from '@/lib/getClerkEmail'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

export const dynamic = 'force-dynamic'

/**
 * POST: Unassign this driver from all orders (super admin only).
 * Optionally reassign all those orders to another driver via body.reassignTo.
 * Use this before deleting a driver in Sanity Studio so references are cleared.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, sessionClaims } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const email = await getEmailForUser(userId, sessionClaims as Record<string, unknown> | null)
  if (!isSuperAdminEmail(email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!token) return NextResponse.json({ error: 'Server config' }, { status: 500 })

  const { id: driverId } = await params
  if (!driverId) return NextResponse.json({ error: 'Missing driver id' }, { status: 400 })

  let body: { reassignTo?: string } = {}
  try {
    body = await req.json().catch(() => ({}))
  } catch {
    // leave body empty
  }

  const reassignTo = typeof body.reassignTo === 'string' && body.reassignTo.trim() ? body.reassignTo.trim() : null

  const driver = await writeClient.fetch<{ _id: string } | null>(
    `*[_type == "driver" && _id == $driverId][0]{ _id }`,
    { driverId }
  )
  if (!driver) return NextResponse.json({ error: 'Driver not found' }, { status: 404 })

  if (reassignTo && reassignTo === driverId) {
    return NextResponse.json({ error: 'Cannot reassign to the same driver' }, { status: 400 })
  }

  if (reassignTo) {
    const otherDriver = await writeClient.fetch<{ _id: string } | null>(
      `*[_type == "driver" && _id == $id][0]{ _id }`,
      { id: reassignTo }
    )
    if (!otherDriver) return NextResponse.json({ error: 'Reassign-to driver not found' }, { status: 400 })
  }

  const orderIds = await writeClient.fetch<string[]>(
    `*[_type == "order" && assignedDriver._ref == $driverId]._id`,
    { driverId }
  )

  if (orderIds.length === 0) {
    return NextResponse.json({ success: true, updated: 0, message: 'No orders reference this driver.' })
  }

  const now = new Date().toISOString()
  let updated = 0

  for (const orderId of orderIds) {
    try {
      if (reassignTo) {
        await writeClient
          .patch(orderId)
          .set({
            assignedDriver: { _type: 'reference', _ref: reassignTo! },
          })
          .commit()
      } else {
        await writeClient
          .patch(orderId)
          .unset(['assignedDriver'])
          .commit()
      }
      updated++
    } catch (e) {
      console.warn(`[admin unassign] Failed to patch order ${orderId}:`, e)
    }
  }

  return NextResponse.json({
    success: true,
    updated,
    message: reassignTo
      ? `Reassigned ${updated} order(s) to the selected driver.`
      : `Unassigned this driver from ${updated} order(s). You can now delete the driver in Sanity Studio.`,
  })
}
