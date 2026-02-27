/**
 * Predefined delivery areas (neighborhoods/districts) per city for quick-add.
 * Key: country code (e.g. PS, IL). Value: city name -> list of { name_en, name_ar }.
 * City keys are case-insensitive when looked up via getAreasForCity.
 * Expand as needed; missing cities return [] and tenant can add custom areas.
 */
export type AreaSuggestion = { name_en: string; name_ar: string }

export const AREAS_BY_COUNTRY_CITY: Record<string, Record<string, AreaSuggestion[]>> = {
  PS: {
    Bethany: [
      { name_en: 'Bethany', name_ar: 'العيزرية' },
      { name_en: 'Abu Dis', name_ar: 'أبو ديس' },
      { name_en: 'Bethany Village', name_ar: 'قرية العيزرية' },
    ],
    'Al-Eizariya': [
      { name_en: 'Bethany', name_ar: 'العيزرية' },
      { name_en: 'Abu Dis', name_ar: 'أبو ديس' },
      { name_en: 'Bethany Village', name_ar: 'قرية العيزرية' },
    ],
    Jerusalem: [
      { name_en: 'Shufat', name_ar: 'شعفاط' },
      { name_en: 'Beit Hanina', name_ar: 'بيت حنينا' },
      { name_en: 'Old City', name_ar: 'البلدة القديمة' },
      { name_en: 'Silwan', name_ar: 'سلوان' },
      { name_en: 'At-Tur', name_ar: 'الطور' },
      { name_en: 'Wadi al-Joz', name_ar: 'وادي الجوز' },
      { name_en: 'Sheikh Jarrah', name_ar: 'الشيخ جراح' },
      { name_en: 'Beit Safafa', name_ar: 'بيت صفافا' },
      { name_en: 'Sur Baher', name_ar: 'صور باهر' },
      { name_en: 'Umm Tuba', name_ar: 'ام طوبا' },
      { name_en: 'Jabel Mukaber', name_ar: 'جبل Mukaber' },
      { name_en: 'East Jerusalem', name_ar: 'القدس الشرقية' },
    ],
    Ramallah: [
      { name_en: 'Al-Bireh', name_ar: 'البيرة' },
      { name_en: 'Beitin', name_ar: 'بتين' },
      { name_en: 'Birzeit', name_ar: 'بيرزيت' },
      { name_en: 'Deir Dibwan', name_ar: 'دير دبوان' },
      { name_en: 'Jifna', name_ar: 'جفنا' },
      { name_en: 'Silwad', name_ar: 'سلواد' },
      { name_en: 'Taybeh', name_ar: 'الطيبة' },
      { name_en: 'Ramallah City', name_ar: 'مدينة رام الله' },
    ],
    Nablus: [
      { name_en: 'Nablus City', name_ar: 'مدينة نابلس' },
      { name_en: 'Askar', name_ar: 'مخيم عسكر' },
      { name_en: 'Balata', name_ar: 'بلاطة' },
      { name_en: 'Sebastia', name_ar: 'سبسطية' },
      { name_en: 'Awarta', name_ar: 'عورتا' },
      { name_en: 'Beita', name_ar: 'بيتا' },
    ],
    Hebron: [
      { name_en: 'Hebron City', name_ar: 'مدينة الخليل' },
      { name_en: 'Halhul', name_ar: 'حلحول' },
      { name_en: 'Dura', name_ar: 'دورا' },
      { name_en: 'Yatta', name_ar: 'يطا' },
      { name_en: 'Bani Na\'im', name_ar: 'بني نعيم' },
    ],
    Bethlehem: [
      { name_en: 'Bethlehem City', name_ar: 'مدينة بيت لحم' },
      { name_en: 'Beit Jala', name_ar: 'بيت جالا' },
      { name_en: 'Beit Sahour', name_ar: 'بيت ساحور' },
      { name_en: 'Dheisheh', name_ar: 'مخيم الدهيشة' },
    ],
    Gaza: [
      { name_en: 'Gaza City', name_ar: 'مدينة غزة' },
      { name_en: 'Jabalia', name_ar: 'جباليا' },
      { name_en: 'Khan Yunis', name_ar: 'خان يونس' },
      { name_en: 'Rafah', name_ar: 'رفح' },
      { name_en: 'Deir al-Balah', name_ar: 'دير البلح' },
    ],
  },
  IL: {
    Jerusalem: [
      { name_en: 'Shufat', name_ar: 'شعفاط' },
      { name_en: 'Beit Hanina', name_ar: 'بيت حنينا' },
      { name_en: 'Pisgat Ze\'ev', name_ar: 'بيسجات زئيف' },
      { name_en: 'Ramot', name_ar: 'راموت' },
      { name_en: 'Gilo', name_ar: 'جيلو' },
      { name_en: 'East Talpiot', name_ar: 'تلبية الشرقية' },
      { name_en: 'Har Nof', name_ar: 'هار نوف' },
      { name_en: 'Bayit Vegan', name_ar: 'بيت فيغان' },
    ],
  },
}

/** Normalize for dedupe: key from area names (lowercase en + ar). */
export function areaKey(a: AreaSuggestion): string {
  return `${(a.name_en ?? '').trim().toLowerCase()}\n${(a.name_ar ?? '').trim()}`
}

/**
 * Predefined areas for a city. Lookup is case-insensitive for city name
 * (e.g. "Bethany", "bethany", "BETHANY" all match).
 */
export function getAreasForCity(countryCode: string, cityName: string): AreaSuggestion[] {
  if (!countryCode || !cityName) return []
  const country = AREAS_BY_COUNTRY_CITY[countryCode.trim().toUpperCase()]
  if (!country) return []
  const cityTrim = cityName.trim()
  if (!cityTrim) return []
  const cityLower = cityTrim.toLowerCase()
  const key = Object.keys(country).find((k) => k.trim().toLowerCase() === cityLower)
  const areas = key ? country[key] : null
  return areas ? [...areas] : []
}
