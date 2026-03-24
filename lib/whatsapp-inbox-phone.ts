export function canonicalWhatsAppInboxPhone(raw: string): string {
  if (!raw) return ''
  // Strip all non-digit characters (including '+')
  return raw.replace(/\D/g, '')
}
