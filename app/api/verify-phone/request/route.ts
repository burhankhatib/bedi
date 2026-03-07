import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Prelude from "@prelude.so/sdk"
import { sendWhatsAppAuthOTP } from '@/lib/meta-whatsapp'
import { client } from '@/sanity/lib/client'

const token = process.env.SANITY_API_WRITE_TOKEN
const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

/** Normalize to E.164 for Israel (+972) and Palestine (+970). Mobile: 9 digits after country code. */
function normalizeE164ILPS(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.startsWith('972')) {
    const local = digits.slice(3).replace(/^0+/, '')
    return '+972' + (local.length >= 9 ? local.slice(0, 9) : local)
  }
  if (digits.startsWith('970')) {
    const local = digits.slice(3).replace(/^0+/, '')
    return '+970' + (local.length >= 9 ? local.slice(0, 9) : local)
  }
  return value
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const { phoneNumber: rawPhone, dispatchId, channel } = await req.json()
    if (!rawPhone || typeof rawPhone !== 'string') {
      return new NextResponse('Phone number is required', { status: 400 })
    }

    const phoneNumber = rawPhone.trim().startsWith('+972') || rawPhone.trim().startsWith('+970')
      ? normalizeE164ILPS(rawPhone.trim())
      : rawPhone.trim()

    const preludeClient = new Prelude({
      apiToken: process.env.PRELUDE_API_KEY!,
    })

    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || req.headers.get('cf-connecting-ip') || undefined

    // Optional: send events to our webhook (requires PRELUDE_WEBHOOK_PUBLIC_KEY for signature verification)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
    const callbackUrl = baseUrl
      ? `${baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`}/api/webhooks/prelude`
      : undefined

    const isIsrael = phoneNumber.startsWith('+972')
    const isPalestine = phoneNumber.startsWith('+970')
    const locale = isIsrael ? 'he-IL' : isPalestine ? 'ar-PS' : undefined

    if (channel === 'meta_whatsapp') {
      const code = Math.floor(100000 + Math.random() * 900000).toString()
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes

      await writeClient.create({
        _type: 'otpVerification',
        phoneNumber,
        code,
        expiresAt,
      })

      const whatsappRes = await sendWhatsAppAuthOTP(phoneNumber, code)
      
      if (!whatsappRes.success) {
        console.error('[Verify Phone] Meta WhatsApp OTP failed:', whatsappRes.error)
        return new NextResponse(JSON.stringify({ error: 'Failed to send WhatsApp OTP', details: whatsappRes.error }), { status: 400 })
      }

      return NextResponse.json({ success: true, method: 'meta_whatsapp' })
    }

    // Determine preferred channel based on client request and environment
    let preferredChannel: string | undefined = undefined
    
    if (channel === 'whatsapp' || channel === 'prelude_whatsapp') {
      preferredChannel = 'whatsapp'
    } else if (channel === 'sms' || channel === 'prelude_sms' || isIsrael) {
      preferredChannel = 'sms'
    }

    const verificationOptions: any = {
      method: "message",
      ...(preferredChannel && { preferred_channel: preferredChannel }),
      ...(locale && { locale }),
      ...(callbackUrl && { callback_url: callbackUrl }),
    }

    const verification = await preludeClient.verification.create({
      target: {
        type: "phone_number",
        value: phoneNumber,
      },
      options: verificationOptions,
      ...(dispatchId && { dispatch_id: dispatchId }),
      ...(ip && { signals: { ip } }),
    })

    return NextResponse.json({ success: true, data: verification })
  } catch (error) {
    console.error('Error in Prelude verification request:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
