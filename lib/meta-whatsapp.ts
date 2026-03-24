import { normalizePhoneForWhatsApp } from '@/lib/whatsapp'
import { WHATSAPP_TEMPLATE, WHATSAPP_TEMPLATE_LANGUAGE_FALLBACK } from '@/lib/whatsapp-meta-templates'

function graphApiVersion(): string {
  const v = (process.env.WHATSAPP_GRAPH_API_VERSION || 'v22.0').trim()
  return v.startsWith('v') ? v : `v${v}`
}

function graphApiVersionsToTry(): string[] {
  const primary = graphApiVersion()
  const fallbacks = ['v22.0', 'v21.0', 'v20.0']
  return [primary, ...fallbacks].filter((v, i, arr) => arr.indexOf(v) === i)
}

async function readJsonOrText(res: Response): Promise<unknown> {
  const text = await res.text()
  if (!text) return { status: res.status, empty: true }
  try {
    return JSON.parse(text) as unknown
  } catch {
    return { status: res.status, raw: text.slice(0, 2000) }
  }
}

/** Template send result; `error` is set when `success` is false. */
export type WhatsAppTemplateSendResult = {
  success: boolean
  error?: unknown
  /** Graph `messages[0].id` — use in Meta Business Suite to trace delivery. */
  messageId?: string
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

/**
 * Human-readable string from Meta Graph / template send failures.
 * Use for logging and checks like "does not exist in ar_EG".
 */
export function formatMetaWhatsAppApiError(err: unknown): string {
  if (err == null) return ''
  if (typeof err === 'string') return err
  if (!isRecord(err)) {
    try {
      return JSON.stringify(err)
    } catch {
      return String(err)
    }
  }
  // Typical Graph body: { error: { message, error_data: { details } } }
  const nested = err['error']
  if (isRecord(nested)) {
    const ed = nested['error_data']
    if (isRecord(ed) && typeof ed['details'] === 'string') {
      return ed['details']
    }
    if (typeof nested['message'] === 'string') {
      return nested['message']
    }
  }
  try {
    return JSON.stringify(err)
  } catch {
    return String(err)
  }
}

function isLikelyGraphVersionError(err: unknown): boolean {
  const msg = formatMetaWhatsAppApiError(err).toLowerCase()
  return (
    msg.includes('unsupported post request') ||
    msg.includes('unknown path components') ||
    msg.includes('unsupported version') ||
    msg.includes('api version')
  )
}

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
  buttonVariable?: string,
  /** Required when the template has a dynamic HEADER IMAGE (Meta error 132012). */
  headerImageUrl?: string
): Promise<WhatsAppTemplateSendResult> {
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

  if (variables.length > 0 || buttonVariable || headerImageUrl) {
    payload.template.components = []

    if (headerImageUrl) {
      payload.template.components.push({
        type: 'header',
        parameters: [
          {
            type: 'image',
            image: { link: headerImageUrl },
          },
        ],
      })
    }

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
    let lastError: unknown
    const versions = graphApiVersionsToTry()

    for (let i = 0; i < versions.length; i++) {
      const version = versions[i]!
      const url = `https://graph.facebook.com/${version}/${phoneNumberId}/messages`
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        const data = (await readJsonOrText(res)) as {
          messages?: Array<{ id?: string }>
        }
        const messageId = typeof data?.messages?.[0]?.id === 'string' ? data.messages[0].id : undefined
        if (messageId) {
          console.log('[Meta WhatsApp] Accepted. wamid:', messageId)
        } else {
          console.log('[Meta WhatsApp] Accepted (no wamid in response — unusual; verify delivery in Meta)')
        }
        return { success: true, messageId }
      }

      const errorData = await readJsonOrText(res)
      console.error('[Meta WhatsApp] API error:', JSON.stringify(errorData, null, 2))
      lastError = { version, error: errorData }

      // Only try lower fallback versions for clear version/path failures.
      if (!isLikelyGraphVersionError(errorData) || i === versions.length - 1) {
        return { success: false, error: lastError }
      }
    }

    return { success: false, error: lastError ?? 'unknown_whatsapp_failure' }
  } catch (error) {
    console.error('[Meta WhatsApp] Exception sending message:', error)
    return { success: false, error }
  }
}

/**
 * Same as sendWhatsAppTemplateMessage but tries approved language codes in order
 * (ar_EG → ar → en_US → en) so one template works across Meta locale drift.
 */
export async function sendWhatsAppTemplateMessageWithLangFallback(
  phone: string,
  templateName: string,
  variables: string[] = [],
  buttonVariable?: string,
  headerImageUrl?: string
): Promise<WhatsAppTemplateSendResult> {
  let lastError: unknown
  for (const lang of WHATSAPP_TEMPLATE_LANGUAGE_FALLBACK) {
    const r = await sendWhatsAppTemplateMessage(phone, templateName, variables, lang, buttonVariable, headerImageUrl)
    if (r.success) return r
    lastError = r.error
  }
  return { success: false, error: lastError }
}

/**
 * subscription_reminder_v2: body only, {{1}} = days remaining (Marketing; static header in Meta if any).
 */
export async function sendSubscriptionReminderWhatsApp(
  phone: string,
  templateName: string,
  daysLeft: number
): Promise<WhatsAppTemplateSendResult> {
  const vars = [String(Math.max(1, Math.round(daysLeft)))]
  return sendWhatsAppTemplateMessageWithLangFallback(phone, templateName, vars)
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

  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body: text },
  }

  try {
    let lastError: unknown
    const versions = graphApiVersionsToTry()

    for (let i = 0; i < versions.length; i++) {
      const version = versions[i]!
      const url = `https://graph.facebook.com/${version}/${phoneNumberId}/messages`
      
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        const data = (await readJsonOrText(res)) as { messages?: Array<{ id: string }> }
        return { success: true, messageId: data.messages?.[0]?.id }
      }

      const errorData = await readJsonOrText(res)
      console.error(`[Meta WhatsApp Text] API error (version ${version}):`, JSON.stringify(errorData, null, 2))
      lastError = { version, error: errorData }

      if (!isLikelyGraphVersionError(errorData) || i === versions.length - 1) {
        return { success: false, error: lastError }
      }
    }
    
    return { success: false, error: lastError ?? 'unknown_whatsapp_failure' }
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

  let lastError: unknown
  for (const lang of WHATSAPP_TEMPLATE_LANGUAGE_FALLBACK) {
    const payload = {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: WHATSAPP_TEMPLATE.OTP,
        language: {
          code: lang,
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
      const versions = graphApiVersionsToTry()
      
      for (let i = 0; i < versions.length; i++) {
        const version = versions[i]!
        const url = `https://graph.facebook.com/${version}/${phoneNumberId}/messages`
        
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(payload),
        })

        if (res.ok) {
          const data = (await readJsonOrText(res)) as { messages?: Array<{ id: string }> }
          return { success: true, messageId: data.messages?.[0]?.id }
        }

        const errorData = await readJsonOrText(res)
        lastError = { version, error: errorData }
        console.error(`[Meta WhatsApp OTP] API error (version ${version}):`, JSON.stringify(errorData, null, 2))
        
        if (!isLikelyGraphVersionError(errorData) || i === versions.length - 1) {
          break
        }
      }
      
      if (lastError && !isLikelyGraphVersionError((lastError as any).error)) {
        // If it's a template issue (e.g. language not found), let the language loop continue
        continue
      }
    } catch (error) {
      lastError = error
      console.error('[Meta WhatsApp OTP] Exception sending OTP:', error)
    }
  }

  return { success: false, error: lastError }
}
