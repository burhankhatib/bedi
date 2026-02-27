/**
 * Convert any Unicode digits (e.g. Arabic-Indic ٠١٢٣٤٥٦٧٨٩, Eastern Arabic ۰۱۲۳۴۵۶۷۸۹)
 * to ASCII English digits 0-9. Required for WhatsApp, tel: links, and APIs that expect
 * Western numerals only.
 */
export function toEnglishDigits(str: string): string {
  if (typeof str !== 'string') return ''
  return str.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (c) =>
    String.fromCharCode((c.charCodeAt(0) & 0xf) + 48)
  )
}
