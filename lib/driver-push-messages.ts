/**
 * Arabic push notification messages for drivers. All text is simple, friendly Arabic.
 * Uses driver nickname for personalization; falls back to "صديقي" when empty.
 */

function nickname(nick: string | undefined | null): string {
  const n = (nick ?? '').trim()
  return n || 'صديقي'
}

/** Welcome message when driver first enables push (after registration or in PWA). */
export function getWelcomePushAr(nick: string | undefined | null): { title: string; body: string } {
  const name = nickname(nick)
  return {
    title: `مرحباً ${name}! 👋`,
    body: 'تم تفعيل الإشعارات. ستستقبل الطلبات الجديدة الآن.',
  }
}

/** Reminder when driver opens PWA and is offline (after 30s). Emphasises: orders only when online. */
export function getOfflineReminderPushAr(nick: string | undefined | null): { title: string; body: string } {
  const name = nickname(nick)
  return {
    title: `${name}، أنت غير متصل`,
    body: 'تستقبل الطلبات فقط عندما تكون متصلاً. ادخل متصل الآن لاستقبال طلبات التوصيل.',
  }
}

/** Sent when driver is auto-set to offline after 8 continuous hours online. Invites them to open the app and go back online. */
export function getAutoOfflinePushAr(nick: string | undefined | null): { title: string; body: string } {
  const name = nickname(nick)
  return {
    title: `${name}، تم إيقاف وضع الاتصال تلقائياً`,
    body: 'تم إيقاف الاتصال بعد 8 ساعات. افتح التطبيق واختر "متصل" مرة أخرى إذا أردت استقبال طلبات التوصيل.',
  }
}

/** English variant for auto-offline FCM (e.g. when driver locale is not stored). */
export function getAutoOfflinePushEn(_nick: string | undefined | null): { title: string; body: string } {
  return {
    title: "You're now offline",
    body: "You were set to offline after 8 hours. Open the app and switch to Online again if you want to receive delivery requests.",
  }
}

/** Sent when admin verifies the driver. */
export function getAdminVerifiedPushAr(nick: string | undefined | null): { title: string; body: string } {
  const name = nickname(nick)
  return {
    title: `أهلاً بك ${name}! 🎉`,
    body: 'تم توثيق حسابك! يمكنك الآن الدخول كـ "متصل" لاستقبال الطلبات.',
  }
}

/** Daily encouraging morning message when driver goes online (once per day, morning hours only). */
export function getMorningEncouragementPushAr(nick: string | undefined | null): { title: string; body: string } {
  const name = nickname(nick)
  return {
    title: `صباح الخير ${name}! ☀️`,
    body: 'يوم جديد، فرص جديدة. ادخل متصل واستقبل طلبات التوصيل. بالتوفيق!',
  }
}

/** Sent to OFFLINE verified drivers when new delivery orders are requested in their area. Reminder only — no order details.
 *  Drivers must go online manually to see orders. This encourages hitting the Online button. */
export function getOfflineOrderAvailableReminderPushAr(_nick?: string | null): { title: string; body: string } {
  return {
    title: 'تنبيه: طلبات توصيل متاحة',
    body: 'يوجد طلبات توصيل متاحة في منطقتك! ادخل متصل لرؤية الطلبات.',
  }
}

/** When business manually assigns an order to the driver (including re-assignment after driver declined). */
export function getManualAssignmentPushAr(
  _nick: string | undefined | null,
  orderNumber: string
): { title: string; body: string } {
  return {
    title: 'طلب توصيل جديد لك! 📦',
    body: `المتجر عيّنك لتوصيل طلب #${orderNumber}. افتح التطبيق لتأكيد أو رفض الطلب.`,
  }
}
