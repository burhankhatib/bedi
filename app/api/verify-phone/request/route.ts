import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

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

    const response = await fetch('https://api.prelude.dev/v2/verification', {
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
      }),
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error('Prelude API error (request):', errorData)
      return new NextResponse('Failed to request verification code', { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Error in Prelude verification request:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
