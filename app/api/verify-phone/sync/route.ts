import { NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { normalizePhone } from '@/lib/driver-utils'
import { normalizePhoneDigits } from '@/lib/order-auth'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

export async function POST() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!token) return NextResponse.json({ error: 'Server config' }, { status: 500 })

    const clientClerk = await clerkClient()
    const user = await clientClerk.users.getUser(userId)
    const primaryPhoneId = user.primaryPhoneNumberId
    const primaryPhone = user.phoneNumbers.find(p => p.id === primaryPhoneId)

    if (!primaryPhone || primaryPhone.verification?.status !== 'verified') {
      return NextResponse.json({ error: 'No verified primary phone found' }, { status: 400 })
    }

    let clerkPhone = primaryPhone.phoneNumber
    if (clerkPhone.startsWith('+')) {
      clerkPhone = clerkPhone.substring(1)
    }
    const phoneNorm = normalizePhone(clerkPhone)
    const phoneNormDigits = normalizePhoneDigits(clerkPhone)

    // Update Driver
    const driver = await client.fetch<{ _id: string; phoneNumber?: string } | null>(
      `*[_type == "driver" && clerkUserId == $userId][0]{ _id, phoneNumber }`,
      { userId }
    )
    if (driver && normalizePhone(driver.phoneNumber || '') !== phoneNorm) {
      await writeClient.patch(driver._id).set({ phoneNumber: clerkPhone, normalizedPhone: phoneNorm }).commit()
    }

    // Update Tenant(s)
    const tenants = await client.fetch<{ _id: string; ownerPhone?: string }[]>(
      `*[_type == "tenant" && clerkUserId == $userId]{ _id, ownerPhone }`,
      { userId }
    )
    for (const tenant of tenants) {
      if (normalizePhoneDigits(tenant.ownerPhone || '') !== phoneNormDigits) {
        await writeClient.patch(tenant._id).set({ ownerPhone: clerkPhone, normalizedOwnerPhone: phoneNormDigits }).commit()
      }
    }

    // Update Customer
    const customer = await client.fetch<{ _id: string; primaryPhone?: string } | null>(
      `*[_type == "customer" && clerkUserId == $userId][0]{ _id, primaryPhone }`,
      { userId }
    )
    if (customer && normalizePhoneDigits(customer.primaryPhone || '') !== phoneNormDigits) {
      await writeClient.patch(customer._id).set({ primaryPhone: clerkPhone }).commit()
    }

    return NextResponse.json({ success: true, phone: clerkPhone })
  } catch (error) {
    console.error('[API] Sync verified phone error:', error)
    return NextResponse.json({ error: 'Failed to sync phone' }, { status: 500 })
  }
}
