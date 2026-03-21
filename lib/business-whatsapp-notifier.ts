import type { SanityClient } from '@sanity/client'
import { appendOrderNotificationDiagnostic } from '@/lib/notification-diagnostics'
import { cleanWhatsAppRecipientPhone, sendTenantNewOrderWhatsApp } from '@/lib/send-tenant-new-order-whatsapp'
import { isStaffOnShiftNow } from '@/lib/staff-shift-availability'

type NotifyMode = 'instant' | 'unaccepted-reminder'

type RecipientSource = 'tenant.ownerPhone' | 'restaurantInfo.socials.whatsapp' | 'tenantStaff.phone'

type Recipient = {
  phone: string
  source: RecipientSource
}

type StaffNotificationRules = {
  receiveWhatsapp?: boolean
  newOrder?: boolean
  unacceptedOrderReminder?: boolean
}

type StaffWorkSchedule = {
  timezone?: string
  days?: Array<{
    dayOfWeek?: number
    enabled?: boolean
    start?: string
    end?: string
  }>
}

type OrderWhatsAppSummary = {
  customerName?: string
  customerPhone?: string
  orderType?: string
  deliveryAddress?: string
  deliveryLat?: number
  deliveryLng?: number
  totalAmount?: number
  currency?: string
  items?: Array<{ productName: string; productNameAr?: string; quantity: number; price: number; total: number }>
}

function phoneDedupeKey(raw: string): string {
  return raw.replace(/\D/g, '')
}

function asCleanPhone(raw: unknown): string {
  return cleanWhatsAppRecipientPhone(typeof raw === 'string' ? raw : '')
}

async function getBusinessWhatsappRecipients(
  writeClient: SanityClient,
  tenantId: string,
  mode: NotifyMode
): Promise<Recipient[]> {
  const allowStaffForMode = (rules?: StaffNotificationRules): boolean => {
    if (rules?.receiveWhatsapp !== true) return false
    if (mode === 'instant') return rules?.newOrder !== false
    return rules?.unacceptedOrderReminder !== false
  }

  const data = await writeClient.fetch<{
    ownerPhone?: string
    businessWhatsapp?: string
    staff?: Array<{
      status?: string
      notificationRules?: StaffNotificationRules
      workSchedule?: StaffWorkSchedule
      phone?: string
      phoneNumber?: string
      mobile?: string
      whatsappPhone?: string
    }>
  } | null>(
    `*[_type == "tenant" && _id == $tenantId][0]{
      ownerPhone,
      "businessWhatsapp": *[_type == "restaurantInfo" && site._ref == ^._id][0].socials.whatsapp,
      "staff": *[_type == "tenantStaff" && site._ref == ^._id]{
        status,
        notificationRules,
        workSchedule,
        phone,
        phoneNumber,
        mobile,
        whatsappPhone
      }
    }`,
    { tenantId }
  )

  const candidates: Recipient[] = []
  const owner = asCleanPhone(data?.ownerPhone)
  if (owner) candidates.push({ phone: owner, source: 'tenant.ownerPhone' })

  const business = asCleanPhone(data?.businessWhatsapp)
  if (business) candidates.push({ phone: business, source: 'restaurantInfo.socials.whatsapp' })

  for (const s of data?.staff ?? []) {
    if (s.status && s.status !== 'active') continue
    if (!isStaffOnShiftNow(s.workSchedule)) continue
    if (!allowStaffForMode(s.notificationRules)) continue
    const phone = asCleanPhone(s.whatsappPhone || s.phoneNumber || s.phone || s.mobile)
    if (phone) candidates.push({ phone, source: 'tenantStaff.phone' })
  }

  const seen = new Set<string>()
  const deduped: Recipient[] = []
  for (const c of candidates) {
    const key = phoneDedupeKey(c.phone)
    if (!key || seen.has(key)) continue
    seen.add(key)
    deduped.push(c)
  }
  return deduped
}

export async function notifyBusinessWhatsappForOrder(params: {
  writeClient: SanityClient
  orderId: string
  tenantId: string
  tenantSlug?: string
  tenantName?: string
  tenantNameAr?: string
  mode: NotifyMode
  skipIfInstantAlreadySent?: boolean
}): Promise<{
  attempted: number
  sent: number
  allFailed: boolean
  skippedReason?: 'instant_already_sent' | 'no_recipients' | 'order_whatsapp_already_handled'
}> {
  const {
    writeClient,
    orderId,
    tenantId,
    tenantSlug,
    tenantName,
    tenantNameAr,
    mode,
    skipIfInstantAlreadySent = false,
  } = params

  const orderDoc = await writeClient.fetch<
    (OrderWhatsAppSummary & {
      businessWhatsappInstantNotifiedAt?: string
      businessWhatsappUnacceptedReminderAt?: string
    }) | null
  >(
    `*[_type == "order" && _id == $orderId][0]{
      customerName,
      customerPhone,
      orderType,
      deliveryAddress,
      deliveryLat,
      deliveryLng,
      totalAmount,
      currency,
      businessWhatsappInstantNotifiedAt,
      businessWhatsappUnacceptedReminderAt,
      items[]{ productName, "productNameAr": product->title_ar, quantity, price, total }
    }`,
    { orderId }
  )

  // One business WhatsApp per order (instant takes precedence over ~3min reminder).
  if (mode === 'instant' && orderDoc?.businessWhatsappInstantNotifiedAt) {
    await appendOrderNotificationDiagnostic(writeClient, orderId, {
      source: 'business-whatsapp-notifier',
      level: 'info',
      message: 'Instant WhatsApp skipped: this order already received a business WhatsApp message',
      detail: { mode, instantAt: orderDoc.businessWhatsappInstantNotifiedAt },
    })
    return { attempted: 0, sent: 0, allFailed: false, skippedReason: 'order_whatsapp_already_handled' }
  }

  if (mode === 'unaccepted-reminder' && orderDoc?.businessWhatsappUnacceptedReminderAt) {
    await appendOrderNotificationDiagnostic(writeClient, orderId, {
      source: 'business-whatsapp-notifier',
      level: 'info',
      message: 'Unaccepted reminder skipped: reminder pipeline already completed for this order',
      detail: { mode, reminderAt: orderDoc.businessWhatsappUnacceptedReminderAt },
    })
    return { attempted: 0, sent: 0, allFailed: false, skippedReason: 'order_whatsapp_already_handled' }
  }

  if (skipIfInstantAlreadySent && orderDoc?.businessWhatsappInstantNotifiedAt) {
    const nowIso = new Date().toISOString()
    if (mode === 'unaccepted-reminder') {
      await writeClient.patch(orderId).set({
        businessWhatsappUnacceptedReminderAt: nowIso,
        businessWhatsappNotifiedAt: nowIso,
      }).commit()
    }
    await appendOrderNotificationDiagnostic(writeClient, orderId, {
      source: 'business-whatsapp-notifier',
      level: 'info',
      message:
        '3-minute reminder skipped: instant WhatsApp already sent — one WhatsApp per order (no duplicate)',
      detail: { mode, instantAt: orderDoc.businessWhatsappInstantNotifiedAt },
    })
    return { attempted: 0, sent: 0, allFailed: false, skippedReason: 'instant_already_sent' }
  }

  const recipients = await getBusinessWhatsappRecipients(writeClient, tenantId, mode)
  if (!recipients.length) {
    const nowIso = new Date().toISOString()
    if (mode === 'unaccepted-reminder') {
      await writeClient.patch(orderId).set({
        businessWhatsappUnacceptedReminderAt: nowIso,
        businessWhatsappNotifiedAt: nowIso,
      }).commit()
    }
    await appendOrderNotificationDiagnostic(writeClient, orderId, {
      source: 'business-whatsapp-notifier',
      level: 'warn',
      message: 'Business WhatsApp skipped: no eligible recipient numbers found (rules/shift/phones)',
      detail: { mode, tenantId },
    })
    return { attempted: 0, sent: 0, allFailed: false, skippedReason: 'no_recipients' }
  }

  const businessName = tenantNameAr?.trim() || tenantName?.trim() || 'Business'
  let sent = 0

  for (const recipient of recipients) {
    const result = await sendTenantNewOrderWhatsApp({
      phone: recipient.phone,
      businessName,
      tenantSlug,
      orderSummaryInput: {
        currency: orderDoc?.currency,
        items: orderDoc?.items,
        totalAmount: orderDoc?.totalAmount,
        customerName: orderDoc?.customerName,
        customerPhone: orderDoc?.customerPhone,
        orderType: orderDoc?.orderType,
        deliveryAddress: orderDoc?.deliveryAddress,
        deliveryLat: orderDoc?.deliveryLat,
        deliveryLng: orderDoc?.deliveryLng,
      },
    })
    if (result.success) {
      sent++
    } else {
      await appendOrderNotificationDiagnostic(writeClient, orderId, {
        source: 'business-whatsapp-notifier',
        level: 'error',
        message: `Business WhatsApp send failed for recipient (${recipient.source})`,
        detail: { mode, recipient: recipient.phone, attempts: result.attempts, error: result.error },
      })
    }
  }

  const nowIso = new Date().toISOString()
  if (mode === 'instant' && sent > 0) {
    await writeClient.patch(orderId).set({ businessWhatsappInstantNotifiedAt: nowIso }).commit()
  }
  // Only mark reminder completion when we actually sent at least one message (or no-recipients branch above).
  if (mode === 'unaccepted-reminder' && sent > 0) {
    await writeClient.patch(orderId).set({
      businessWhatsappUnacceptedReminderAt: nowIso,
      businessWhatsappNotifiedAt: nowIso,
    }).commit()
  }

  await appendOrderNotificationDiagnostic(writeClient, orderId, {
    source: 'business-whatsapp-notifier',
    level: sent > 0 ? 'info' : 'warn',
    message:
      sent > 0
        ? `Business WhatsApp ${mode} sent to ${sent}/${recipients.length} recipients`
        : `Business WhatsApp ${mode} failed for all recipients`,
    detail: {
      mode,
      attempted: recipients.length,
      sent,
      recipientSources: recipients.map((r) => r.source),
    },
  })

  return { attempted: recipients.length, sent, allFailed: recipients.length > 0 && sent === 0 }
}
