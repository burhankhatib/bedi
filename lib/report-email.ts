/**
 * Send report notification email to super admin via Resend API.
 * Set RESEND_API_KEY in env. From address must be a verified domain in Resend (or use onboarding@resend.dev for testing).
 */

const RESEND_API = 'https://api.resend.com/emails'
const ADMIN_EMAIL = 'burhank@gmail.com'

export type ReportEmailPayload = {
  reporterType: 'business' | 'driver' | 'customer'
  reportedType: 'business' | 'driver' | 'customer'
  category: string
  description?: string
  orderNumber?: string
  orderId?: string
  reporterInfo?: string
  reportedInfo?: string
}

export async function sendReportEmail(payload: ReportEmailPayload): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.REPORT_FROM_EMAIL || 'Bedi Delivery <reports@bedi.delivery>'

  if (!apiKey) {
    console.warn('[report-email] RESEND_API_KEY not set; skipping email.')
    return false
  }

  const reporterLabel = { business: 'Business', driver: 'Driver', customer: 'Customer' }[payload.reporterType]
  const reportedLabel = { business: 'Restaurant/Business', driver: 'Driver', customer: 'Customer' }[payload.reportedType]

  const subject = `[Report] ${reporterLabel} → ${reportedLabel}${payload.orderNumber ? ` — Order #${payload.orderNumber}` : ''}`

  const html = `
    <h2>New report submitted</h2>
    <p><strong>Reporter:</strong> ${reporterLabel}${payload.reporterInfo ? ` (${payload.reporterInfo})` : ''}</p>
    <p><strong>Reported:</strong> ${reportedLabel}${payload.reportedInfo ? ` (${payload.reportedInfo})` : ''}</p>
    <p><strong>Category:</strong> ${payload.category}</p>
    ${payload.orderNumber ? `<p><strong>Order #:</strong> ${payload.orderNumber}${payload.orderId ? ` (ID: ${payload.orderId})` : ''}</p>` : ''}
    ${payload.description ? `<p><strong>Details:</strong></p><p>${payload.description.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>` : ''}
    <p><em>View all reports in Super Admin dashboard: /admin/reports</em></p>
  `

  try {
    const res = await fetch(RESEND_API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [ADMIN_EMAIL],
        subject,
        html,
      }),
    })
    if (!res.ok) {
      const err = await res.text()
      console.error('[report-email] Resend error:', res.status, err)
      return false
    }
    return true
  } catch (e) {
    console.error('[report-email] Failed to send:', e)
    return false
  }
}
