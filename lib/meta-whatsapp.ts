import { normalizePhoneForWhatsApp } from '@/lib/whatsapp'

/**
 * Send a WhatsApp template message using Meta's Cloud API.
 * 
 * @param phone The recipient's phone number
 * @param templateName The name of the template to send
 * @param variables Array of text variables to inject into the template body
 * @param languageCode The language code of the template (e.g., 'ar', 'en')
 */
export async function sendWhatsAppTemplateMessage(
  phone: string,
  templateName: string,
  variables: string[] = [],
  languageCode: string = 'ar'
) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN

  console.log('[Meta WhatsApp] Using phone number ID:', phoneNumberId ? '***' + phoneNumberId.slice(-4) : 'MISSING')
  console.log('[Meta WhatsApp] Using access token:', accessToken ? 'PRESENT' : 'MISSING') // don't log token

  if (!phoneNumberId || !accessToken) {
    console.error('[Meta WhatsApp] API credentials missing in environment variables.')
    return { success: false, error: 'API credentials missing in environment variables' }
  }

  // Normalize phone to E.164 without the '+'
  const to = normalizePhoneForWhatsApp(phone)
  console.log('[Meta WhatsApp] Original phone:', phone, 'Normalized to:', to)
  
  if (!to) {
    console.error(`[Meta WhatsApp] Invalid phone number provided: ${phone}`)
    return { success: false, error: 'Invalid phone number provided' }
  }

  const url = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`

  const payload: any = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: {
        code: languageCode,
      },
    },
  }

  if (variables.length > 0) {
    payload.template.components = [
      {
        type: 'body',
        parameters: variables.map((text) => ({
          type: 'text',
          text: text || 'Business', // Fallback in case of empty string
        })),
      },
    ]
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const errorData = await res.json()
      console.error('[Meta WhatsApp] API error:', JSON.stringify(errorData, null, 2))
      return { success: false, error: errorData }
    }

    return { success: true }
  } catch (error) {
    console.error('[Meta WhatsApp] Exception sending message:', error)
    return { success: false, error }
  }
}

/**
 * Send an Authentication OTP via Meta WhatsApp Cloud API.
 * 
 * @param phone The recipient's phone number
 * @param code The OTP code to send
 */
export async function sendWhatsAppAuthOTP(phone: string, code: string) {
  // Using the exact same method as new_order but with the bedi_otp template
  return sendWhatsAppTemplateMessage(phone, 'bedi_otp', [code], 'ar')
}
