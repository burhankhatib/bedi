import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { isSuperAdminEmail } from '@/lib/constants'
import { getEmailForUser } from '@/lib/getClerkEmail'
import { getPlatformUser } from '@/lib/platform-user'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

export const dynamic = 'force-dynamic'

/** DELETE: Permanently delete a driver (super admin only). Also reassigns orders to a Default Driver to prevent orphaned references. */
export async function DELETE(
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

  const driver = await writeClient.fetch<{ _id: string; clerkUserId?: string } | null>(
    `*[_type == "driver" && _id == $driverId][0]{ _id, clerkUserId }`,
    { driverId }
  )
  if (!driver) return NextResponse.json({ error: 'Driver not found' }, { status: 404 })

  try {
    // 1. Find or create "Default Driver"
    let defaultDriver = await writeClient.fetch<{ _id: string } | null>(
      `*[_type == "driver" && name == "Default Driver"][0]{ _id }`
    )
    if (!defaultDriver) {
      defaultDriver = await writeClient.create({
        _type: 'driver',
        name: 'Default Driver',
        phoneNumber: '0000000000',
        normalizedPhone: '0000000000',
        isActive: false,
        rulesAcknowledged: true,
      })
    }

    // 2. Reassign all orders to Default Driver
    const orderIds = await writeClient.fetch<string[]>(
      `*[_type == "order" && assignedDriver._ref == $driverId]._id`,
      { driverId: driver._id }
    )

    for (const orderId of orderIds) {
      try {
        await writeClient
          .patch(orderId)
          .set({
            assignedDriver: { _type: 'reference', _ref: defaultDriver._id },
          })
          .commit()
      } catch (e) {
        console.warn(`[Admin Driver Delete] Failed to patch order ${orderId}:`, e)
      }
    }

    // 3. Delete driver profile
    await writeClient.delete(driver._id)

    // 4. Update platformUser to remove isDriver status if applicable
    if (driver.clerkUserId) {
      const existing = await getPlatformUser(driver.clerkUserId)
      if (existing) {
        await writeClient.patch(existing._id).set({ isDriver: false }).commit()
      }
    }

    return NextResponse.json({ success: true, message: 'Driver profile deleted permanently.' })
  } catch (err) {
    console.error('[Admin Driver Delete] Error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}