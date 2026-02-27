/**
 * Arabic names for countries and cities used in Tenant/Driver registration.
 * When lang === 'ar', use these for dropdowns; otherwise use the API English name.
 */

/** Country code -> Arabic name */
export const COUNTRY_NAMES_AR: Record<string, string> = {
  IL: 'إسرائيل',
  PS: 'فلسطين',
}

/** City name (English) -> Arabic name. Used for Palestine (PS) fallback cities. */
export const CITY_NAMES_AR: Record<string, string> = {
  'Bethany': 'العيزرية',
  'Al-Bireh': 'البيرة',
  'Anabta': 'عنبتا',
  'Ariha': 'أريحا',
  'Bani Na\'im': 'بني نعيم',
  'Beit Hanoun': 'بيت حانون',
  'Beit Lahia': 'بيت لاهيا',
  'Bethlehem': 'بيت لحم',
  'Deir al-Balah': 'دير البلح',
  'Dura': 'دورا',
  'Gaza': 'غزة',
  'Halhul': 'حلحول',
  'Hebron': 'الخليل',
  'Jabalia': 'جباليا',
  'Jenin': 'جنين',
  'Jericho': 'أريحا',
  'Jerusalem': 'القدس',
  'Khan Yunis': 'خان يونس',
  'Nablus': 'نابلس',
  'Qalqilya': 'قلقيلية',
  'Rafah': 'رفح',
  'Ramallah': 'رام الله',
  'Salfit': 'سلفيت',
  'Tubas': 'طوباس',
  'Tulkarm': 'طولكرم',
  'Yatta': 'يطا',
}

export function getCountryNameAr(code: string): string | undefined {
  return COUNTRY_NAMES_AR[code]
}

export function getCityNameAr(cityNameEn: string): string | undefined {
  return CITY_NAMES_AR[cityNameEn]
}

/** Use when displaying country/city in the UI: returns Arabic name when lang is 'ar', otherwise the original. */
export function getCountryDisplayName(code: string | null | undefined, lang: string): string {
  if (!code) return ''
  return lang === 'ar' ? (COUNTRY_NAMES_AR[code] ?? code) : code
}

export function getCityDisplayName(cityEn: string | null | undefined, lang: string): string {
  if (!cityEn) return ''
  return lang === 'ar' ? (CITY_NAMES_AR[cityEn] ?? cityEn) : cityEn
}
