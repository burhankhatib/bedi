import dotenv from 'dotenv'
import { normalizePhoneForWhatsApp } from './lib/whatsapp.ts'

dotenv.config({ path: '.env.local' })

async function sendWhatsAppTemplateMessage(
  phone,
  templateName,
  variables = [],
  languageCode = 'ar',
  buttonVariable = undefined
) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN

  const to = normalizePhoneForWhatsApp(phone)
  
  const url = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`

  const payload = {
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
          text: text || 'Business',
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

  console.log('Sending payload:', JSON.stringify(payload, null, 2))

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
    console.error('API error:', JSON.stringify(errorData, null, 2))
    return { success: false, error: errorData }
  }
  return { success: true }
}

async function run() {
  const result1 = await sendWhatsAppTemplateMessage(
    '972546708508', // King Broast owner
    'new_order',
    ['King Broast'], // 1 variable in body
    'ar',
    'kingbroast/orders' // dynamic URL var
  )
  console.log('Result ar:', result1)
  
  if (!result1.success) {
      const result2 = await sendWhatsAppTemplateMessage(
        '972546708508', // King Broast owner
        'new_order',
        ['King Broast'], // 1 variable in body
        'ar_EG',
        'kingbroast/orders' // dynamic URL var
      )
      console.log('Result ar_EG:', result2)
  }
}

run()