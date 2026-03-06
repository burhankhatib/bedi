import { NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import Prelude from "@prelude.so/sdk"

export async function POST(req: Request) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const { phoneNumber, code, intentChange } = await req.json()
    if (!phoneNumber || !code) {
      return new NextResponse('Phone number and code are required', { status: 400 })
    }

    // 1. Verify with Prelude
    const client = new Prelude({
      apiToken: process.env.PRELUDE_API_KEY!,
    })

    const verification = await client.verification.check({
      target: {
        type: 'phone_number',
        value: phoneNumber,
      },
      code: code,
    })

    if (verification.status !== 'success') {
      return new NextResponse('Verification failed', { status: 400 })
    }

    // 2. Mark as verified in Clerk
    const clerk = await clerkClient()
    
    // First, let's see if the user already has this phone number added but unverified
    const user = await clerk.users.getUser(userId)
    const existingPhone = user.phoneNumbers.find((p) => p.phoneNumber === phoneNumber)
    
    let verifiedPhoneId: string

    if (existingPhone) {
      verifiedPhoneId = existingPhone.id
      // If it exists but is unverified, verify it
      if (existingPhone.verification?.status !== 'verified') {
        await clerk.phoneNumbers.updatePhoneNumber(existingPhone.id, {
          verified: true,
        })
      }
    } else {
      // If it doesn't exist, create it as verified
      const newPhone = await clerk.phoneNumbers.createPhoneNumber({
        userId,
        phoneNumber,
        verified: true,
        primary: true,
      })
      verifiedPhoneId = newPhone.id
    }

    if (!user.primaryPhoneNumberId || intentChange) {
      await clerk.users.updateUser(userId, { primaryPhoneNumberID: verifiedPhoneId })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in Prelude verification check:', error)
    return new NextResponse('Invalid or expired verification code', { status: 400 })
  }
}
