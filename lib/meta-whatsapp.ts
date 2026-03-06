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

  if (!phoneNumberId || !accessToken) {
    console.error('[Meta WhatsApp] API credentials missing in environment variables.')
    return false
  }

  // Normalize phone to E.164 without the '+'
  const to = normalizePhoneForWhatsApp(phone)
  if (!to) {
    console.error(`[Meta WhatsApp] Invalid phone number provided: ${phone}`)
    return false
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
      return false
    }

    return true
  } catch (error) {
    console.error('[Meta WhatsApp] Exception sending message:', error)
    return false
  }
}
