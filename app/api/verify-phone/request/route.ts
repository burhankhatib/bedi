import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Prelude from "@prelude.so/sdk"

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const { phoneNumber } = await req.json()
    if (!phoneNumber) {
      return new NextResponse('Phone number is required', { status: 400 })
    }

    const client = new Prelude({
      apiToken: process.env.PRELUDE_API_KEY!,
    })

    const verification = await client.verification.create({
      target: {
        type: "phone_number",
        value: phoneNumber,
      },
    })

    return NextResponse.json({ success: true, data: verification })
  } catch (error) {
    console.error('Error in Prelude verification request:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
