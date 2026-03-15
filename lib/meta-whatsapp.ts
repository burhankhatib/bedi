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
  languageCode: string = 'ar',
  buttonVariable?: string
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

  if (variables.length > 0 || buttonVariable) {
    payload.template.components = []

    if (variables.length > 0) {
      payload.template.components.push({
        type: 'body',
        parameters: variables.map((text) => ({
          type: 'text',
          text: text || 'Business', // Fallback in case of empty string
        })),
      })
    }

    if (buttonVariable) {
      payload.template.components.push({
        type: 'button',
        sub_type: 'url',
        index: '0',
        parameters: [
          {
            type: 'text',
            text: buttonVariable,
          },
        ],
      })
    }
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
 * Send a free-form text message via Meta WhatsApp Cloud API.
 * Only works within the 24-hour conversation window after the user's last message.
 * Outside that window, use sendWhatsAppTemplateMessage.
 */
export async function sendWhatsAppTextMessage(phone: string, text: string) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN

  if (!phoneNumberId || !accessToken) {
    return { success: false, error: 'API credentials missing in environment variables' }
  }

  const to = normalizePhoneForWhatsApp(phone)
  if (!to) {
    return { success: false, error: 'Invalid phone number provided' }
  }

  const url = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`
  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body: text },
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
      console.error('[Meta WhatsApp Text] API error:', JSON.stringify(errorData, null, 2))
      return { success: false, error: errorData }
    }

    const data = (await res.json()) as { messages?: Array<{ id: string }> }
    return { success: true, messageId: data.messages?.[0]?.id }
  } catch (error) {
    console.error('[Meta WhatsApp Text] Exception:', error)
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
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN

  if (!phoneNumberId || !accessToken) {
    console.error('[Meta WhatsApp OTP] API credentials missing.')
    return { success: false, error: 'API credentials missing' }
  }

  const to = normalizePhoneForWhatsApp(phone)
  if (!to) {
    console.error(`[Meta WhatsApp OTP] Invalid phone number: ${phone}`)
    return { success: false, error: 'Invalid phone number' }
  }

  const url = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`

  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: 'otp',
      language: {
        code: 'ar_EG',
      },
      components: [
        {
          type: 'body',
          parameters: [
            {
              type: 'text',
              text: code,
            },
          ],
        },
        {
          type: 'button',
          sub_type: 'url',
          index: '0',
          parameters: [
            {
              type: 'text',
              text: code,
            },
          ],
        },
      ],
    },
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
      console.error('[Meta WhatsApp OTP] API error:', JSON.stringify(errorData, null, 2))
      return { success: false, error: errorData }
    }

    return { success: true }
  } catch (error) {
    console.error('[Meta WhatsApp OTP] Exception sending OTP:', error)
    return { success: false, error }
  }
}
