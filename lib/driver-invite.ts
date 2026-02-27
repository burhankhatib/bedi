/** Sign-up link for drivers — use production URL so WhatsApp message works from any domain */
export const DRIVER_SIGNUP_URL = 'https://www.bedi.delivery/sign-up?redirect_url=/'

/** WhatsApp invite message for drivers — Arabic only, personalized with driver name */
export function getDriverInviteMessageAr(driverName: string): string {
  const name = (driverName || '').trim() || 'صديقي'
  return `مرحباً ${name}! 👋

ندعوك للانضمام كسائق توصيل معنا. سجّل عبر الرابط التالي لإنشاء حسابك وإكمال بياناتك:

${DRIVER_SIGNUP_URL}
`
}
