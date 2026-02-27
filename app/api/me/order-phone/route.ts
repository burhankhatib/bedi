import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getTrustedPhoneForUser, getVerifiedPhoneNumbers } from '@/lib/order-auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/me/order-phone
 * Returns the phone number to use for ordering: trusted (driver/tenant) or first Clerk-verified.
 * Drivers and tenants with a phone in the system get that number treated as verified
 * so they can place orders without SMS verification.
 */
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ hasVerifiedPhone: false, verifiedPhoneValue: '' })

  try {
    const trusted = await getTrustedPhoneForUser(userId)
    if (trusted?.e164) {
      return NextResponse.json(
        { hasVerifiedPhone: true, verifiedPhoneValue: trusted.e164 },
        { headers: { 'Cache-Control': 'no-store' } }
      )
    }
    const verified = await getVerifiedPhoneNumbers(userId)
    const first = verified[0]
    const e164 = first ? (first.startsWith('+') ? first : `+${first}`) : ''
    return NextResponse.json(
      { hasVerifiedPhone: !!e164, verifiedPhoneValue: e164 },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch {
    return NextResponse.json({ hasVerifiedPhone: false, verifiedPhoneValue: '' })
  }
}
