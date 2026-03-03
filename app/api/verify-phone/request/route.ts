import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Prelude from "@prelude.so/sdk"

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const { phoneNumber, dispatchId } = await req.json()
    if (!phoneNumber) {
      return new NextResponse('Phone number is required', { status: 400 })
    }

    const client = new Prelude({
      apiToken: process.env.PRELUDE_API_KEY!,
    })

    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || req.headers.get('cf-connecting-ip') || undefined

    // Optional: send events to our webhook (requires PRELUDE_WEBHOOK_PUBLIC_KEY for signature verification)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
    const callbackUrl = baseUrl
      ? `${baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`}/api/webhooks/prelude`
      : undefined

    // Prefer WhatsApp for +972/+970; force message channel (no silent verification) so OTP is actually sent
    const isIsrael = phoneNumber.startsWith('+972')
    const isPalestine = phoneNumber.startsWith('+970')
    const locale = isIsrael ? 'he-IL' : isPalestine ? 'ar-PS' : undefined

    const verification = await client.verification.create({
      target: {
        type: "phone_number",
        value: phoneNumber,
      },
      options: {
        method: "message",
        preferred_channel: "whatsapp",
        ...(locale && { locale }),
        ...(callbackUrl && { callback_url: callbackUrl }),
      },
      ...(dispatchId && { dispatch_id: dispatchId }),
      ...(ip && { signals: { ip } }),
    })

    return NextResponse.json({ success: true, data: verification })
  } catch (error) {
    console.error('Error in Prelude verification request:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
