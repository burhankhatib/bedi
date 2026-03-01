import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getVerifiedPhoneNumbers } from '@/lib/order-auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/me/order-phone
 * Returns the first Clerk-verified phone number to use for ordering.
 */
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ hasVerifiedPhone: false, verifiedPhoneValue: '' })

  try {
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
