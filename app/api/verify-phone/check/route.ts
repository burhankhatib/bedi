import { NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import Prelude from "@prelude.so/sdk"

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
    const client = new Prelude({
      apiToken: process.env.PRELUDE_API_KEY!,
    })

    // #region agent log
    fetch('http://127.0.0.1:7893/ingest/a956dccd-3cc7-4993-8038-2d7f86d93e5e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'9a2ec5'},body:JSON.stringify({sessionId:'9a2ec5',hypothesisId:'H3',location:'check/route.ts:17',message:'Before Prelude check',data:{phoneNumber, code},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

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
    
    if (existingPhone) {
      // If it exists but is unverified, verify it
      if (existingPhone.verification?.status !== 'verified') {
        await clerk.phoneNumbers.updatePhoneNumber(existingPhone.id, {
          verified: true,
        })
      }
    } else {
      // If it doesn't exist, create it as verified
      await clerk.phoneNumbers.createPhoneNumber({
        userId,
        phoneNumber,
        verified: true,
        primary: true,
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7893/ingest/a956dccd-3cc7-4993-8038-2d7f86d93e5e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'9a2ec5'},body:JSON.stringify({sessionId:'9a2ec5',hypothesisId:'H1',location:'check/route.ts:catch',message:'Check route error',data:{errMsg: error instanceof Error ? error.message : String(error), errStack: error instanceof Error ? error.stack : undefined},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    console.error('Error in Prelude verification check:', error)
    return new NextResponse('Invalid or expired verification code', { status: 400 })
  }
}
