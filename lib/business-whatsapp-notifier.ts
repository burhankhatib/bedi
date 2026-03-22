import type { SanityClient } from '@sanity/client'
import { appendOrderNotificationDiagnostic } from '@/lib/notification-diagnostics'
import { cleanWhatsAppRecipientPhone, sendTenantNewOrderWhatsApp } from '@/lib/send-tenant-new-order-whatsapp'
import { isStaffOnShiftNow } from '@/lib/staff-shift-availability'
import { sendTenantAndStaffPush } from '@/lib/tenant-and-staff-push'
import { isFCMConfigured } from '@/lib/fcm'
import { isPushConfigured } from '@/lib/push'

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
  status?: string
  orderNumber?: string
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
    // 3‑min unaccepted reminder: same urgency as delivery — notify staff even if not “on shift”
    if (mode !== 'unaccepted-reminder' && !isStaffOnShiftNow(s.workSchedule)) continue
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
  skippedReason?:
    | 'instant_already_sent'
    | 'no_recipients'
    | 'order_whatsapp_already_handled'
    | 'order_not_new'
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
      status,
      orderNumber,
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

  if (!orderDoc) {
    return { attempted: 0, sent: 0, allFailed: false, skippedReason: 'order_whatsapp_already_handled' }
  }

  if (mode === 'unaccepted-reminder' && orderDoc.status !== 'new') {
    await appendOrderNotificationDiagnostic(writeClient, orderId, {
      source: 'business-whatsapp-notifier',
      level: 'info',
      message: 'Unaccepted reminder skipped: order missing or no longer in status "new"',
      detail: { status: orderDoc?.status },
    })
    return { attempted: 0, sent: 0, allFailed: false, skippedReason: 'order_not_new' }
  }

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

  // FCM / Web Push: same fan-out as new orders (3a tenant legacy → 3b central → 3c staff legacy) for every order type still in "new" after ~3 min (dine-in, pickup, delivery, collaborative QR, etc.)
  if (
    mode === 'unaccepted-reminder' &&
    orderDoc?.status === 'new' &&
    (isFCMConfigured() || isPushConfigured())
  ) {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
      const base = baseUrl ? baseUrl.replace(/\/$/, '') : ''
      let slug = (tenantSlug || '').trim()
      if (!slug) {
        const s = await writeClient.fetch<{ slug?: string } | null>(
          `*[_type == "tenant" && _id == $tenantId][0]{ "slug": slug.current }`,
          { tenantId }
        )
        slug = (s?.slug ?? '').trim()
      }
      const path = slug ? `/t/${slug}/orders?open=${encodeURIComponent(orderId)}` : '/orders'
      const url = base ? `${base}${path}` : path
      const orderNum = orderDoc.orderNumber != null ? String(orderDoc.orderNumber) : orderId.slice(-6)
      const title = `طلب لم يُقبل بعد — #${orderNum}`
      const body =
        'الطلب ما زال جديداً بعد 3 دقائق. افتح التطبيق للقبول أو المراجعة.'
      await sendTenantAndStaffPush(
        tenantId,
        { title, body, url, dir: 'rtl' },
        { eventType: 'unaccepted_reminder' }
      )
    } catch (e) {
      console.warn('[business-whatsapp-notifier] unaccepted-reminder FCM fan-out failed', orderId, e)
      await appendOrderNotificationDiagnostic(writeClient, orderId, {
        source: 'business-whatsapp-notifier',
        level: 'warn',
        message: 'Unaccepted-reminder FCM fan-out failed (WhatsApp may still send)',
        detail: { error: e instanceof Error ? e.message : String(e) },
      })
    }
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
  const reminderMode = mode === 'unaccepted-reminder'
  /** Meta occasionally returns transient errors; reminder path also benefits from a second try after ~2.5s. */
  const maxSendAttempts = reminderMode ? 2 : 1

  for (const recipient of recipients) {
    let lastResult: Awaited<ReturnType<typeof sendTenantNewOrderWhatsApp>> | undefined
    for (let attempt = 1; attempt <= maxSendAttempts; attempt++) {
      lastResult = await sendTenantNewOrderWhatsApp({
        phone: recipient.phone,
        businessName,
        tenantSlug,
        reminderMode,
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
      if (lastResult.success) {
        sent++
        break
      }
      if (attempt < maxSendAttempts) {
        await new Promise((r) => setTimeout(r, 2500))
      }
    }
    if (!lastResult?.success) {
      await appendOrderNotificationDiagnostic(writeClient, orderId, {
        source: 'business-whatsapp-notifier',
        level: 'error',
        message: `Business WhatsApp send failed for recipient (${recipient.source})`,
        detail: {
          mode,
          recipient: recipient.phone,
          attempts: lastResult?.attempts,
          error: lastResult?.error,
          reminderMode,
        },
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
