import { NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const { phoneNumber, code } = await req.json()
    if (!phoneNumber || !code) {
      return new NextResponse('Phone number and code are required', { status: 400 })
    }

    // 1. Verify with Prelude
    const response = await fetch('https://api.prelude.dev/v2/verification/check', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.PRELUDE_API_KEY}`,
      },
      body: JSON.stringify({
        target: {
          type: 'phone_number',
          value: phoneNumber,
        },
        code: code,
      }),
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error('Prelude API error (check):', errorData)
      return new NextResponse('Invalid or expired verification code', { status: 400 })
    }

    const preludeData = await response.json()
    if (preludeData.status !== 'success') {
      return new NextResponse('Verification failed', { status: 400 })
    }

    // 2. Mark as verified in Clerk
    const client = await clerkClient()
    
    // First, let's see if the user already has this phone number added but unverified
    const user = await client.users.getUser(userId)
    const existingPhone = user.phoneNumbers.find((p) => p.phoneNumber === phoneNumber)
    
    if (existingPhone) {
      // If it exists but is unverified, verify it
      if (existingPhone.verification?.status !== 'verified') {
        await client.phoneNumbers.updatePhoneNumber(existingPhone.id, {
          verified: true,
        })
      }
    } else {
      // If it doesn't exist, create it as verified
      await client.phoneNumbers.createPhoneNumber({
        userId,
        phoneNumber,
        verified: true,
        primary: true,
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in Prelude verification check:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
