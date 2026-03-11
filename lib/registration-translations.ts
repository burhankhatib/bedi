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

export const GEO_CITY_ALIASES: Record<string, string> = {
  // Bethany aliases
  'abu dis': 'Bethany',
  'أبو ديس': 'Bethany',
  'al-eizariya': 'Bethany',
  'العيزرية': 'Bethany',
  'al eizariya': 'Bethany',
  'alrass': 'Bethany',
  'الراس': 'Bethany',
  'al-ram': 'Bethany',
  'الرام': 'Bethany',
  'area b': 'Bethany', // Often returned by Nominatim for Bethany
  'منطقة ب': 'Bethany',
  'area c': 'Bethany',
  'منطقة ج': 'Bethany',

  // Ramallah & Al-Bireh aliases
  'ramallah': 'Ramallah',
  'رام الله': 'Ramallah',
  'al-bireh': 'Al-Bireh',
  'البيرة': 'Al-Bireh',
  'al bireh': 'Al-Bireh',
  'betunia': 'Ramallah',
  'بيتونيا': 'Ramallah',
  'surda': 'Ramallah',
  'سردا': 'Ramallah',

  // Bethlehem aliases
  'bethlehem': 'Bethlehem',
  'بيت لحم': 'Bethlehem',
  'beit jala': 'Bethlehem',
  'بيت جالا': 'Bethlehem',
  'beit sahour': 'Bethlehem',
  'بيت ساحور': 'Bethlehem',
  'dheisheh': 'Bethlehem',
  'الدهيشة': 'Bethlehem',
  'al-khader': 'Bethlehem',
  'الخضر': 'Bethlehem',
  'area a': 'Bethlehem', // Nominatim tends to use these generic areas
  'منطقة أ': 'Bethlehem',

  // Hebron aliases
  'hebron': 'Hebron',
  'الخليل': 'Hebron',
  'dura': 'Dura',
  'دورا': 'Dura',
  'halhul': 'Halhul',
  'حلحول': 'Halhul',
  'yatta': 'Yatta',
  'يطا': 'Yatta',
  'bani na\'im': 'Bani Na\'im',
  'بني نعيم': 'Bani Na\'im',
  'tarkumiya': 'Hebron',
  'ترقوميا': 'Hebron',

  // Nablus aliases
  'nablus': 'Nablus',
  'نابلس': 'Nablus',
  'huwara': 'Nablus',
  'حوارة': 'Nablus',
  'balata': 'Nablus',
  'بلاطة': 'Nablus',
  'askar': 'Nablus',
  'عسكر': 'Nablus',

  // Jenin aliases
  'jenin': 'Jenin',
  'جنين': 'Jenin',
  'qabatiya': 'Jenin',
  'قباطية': 'Jenin',
  'arraba': 'Jenin',
  'عرابة': 'Jenin',

  // Tulkarm aliases
  'tulkarm': 'Tulkarm',
  'طولكرم': 'Tulkarm',
  'nur shams': 'Tulkarm',
  'نور شمس': 'Tulkarm',
  'anabta': 'Anabta',
  'عنبتا': 'Anabta',

  // Jericho aliases
  'jericho': 'Jericho',
  'ariha': 'Jericho',
  'أريحا': 'Jericho',
  'aqabat jaber': 'Jericho',
  'عقبة جبر': 'Jericho',

  // Qalqilya aliases
  'qalqilya': 'Qalqilya',
  'قلقيلية': 'Qalqilya',
  'azzun': 'Qalqilya',
  'عزون': 'Qalqilya',

  // Salfit & Tubas
  'salfit': 'Salfit',
  'سلفيت': 'Salfit',
  'tubas': 'Tubas',
  'طوباس': 'Tubas',

  // Jerusalem aliases
  'jerusalem': 'Jerusalem',
  'القدس': 'Jerusalem',
  'al-quds': 'Jerusalem',
  'east jerusalem': 'Jerusalem',
  'القدس الشرقية': 'Jerusalem',
  'shuafat': 'Jerusalem',
  'شعفاط': 'Jerusalem',
  'beit hanina': 'Jerusalem',
  'بيت حنينا': 'Jerusalem',

  // Gaza aliases
  'gaza': 'Gaza',
  'غزة': 'Gaza',
  'gaza city': 'Gaza',
  'مدينة غزة': 'Gaza',
  'jabalia': 'Jabalia',
  'جباليا': 'Jabalia',
  'beit hanoun': 'Beit Hanoun',
  'بيت حانون': 'Beit Hanoun',
  'beit lahia': 'Beit Lahia',
  'بيت لاهيا': 'Beit Lahia',
  'deir al-balah': 'Deir al-Balah',
  'دير البلح': 'Deir al-Balah',
  'khan yunis': 'Khan Yunis',
  'خان يونس': 'Khan Yunis',
  'rafah': 'Rafah',
  'رفح': 'Rafah',
}
