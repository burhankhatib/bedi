/**
 * Common menu section names by business type.
 * Used when a tenant adds a new section to the menu.
 * Pick from these for better categorization and search, or add custom.
 */

export type MenuSection = { title_en: string; title_ar: string }

/** Restaurant, cafe, bakery: food-service sections (e.g. Appetizers, Main Dishes). */
export const RESTAURANT_MENU_SECTIONS: MenuSection[] = [
  { title_en: 'Appetizers', title_ar: 'مقبلات' },
  { title_en: 'Main Dishes', title_ar: 'أطباق رئيسية' },
  { title_en: 'Desserts', title_ar: 'حلويات' },
  { title_en: 'Drinks', title_ar: 'مشروبات' },
  { title_en: 'Sides', title_ar: 'أطباق جانبية' },
  { title_en: 'Salads', title_ar: 'سلطات' },
  { title_en: 'Sandwiches', title_ar: 'شطائر' },
  { title_en: 'Breakfast', title_ar: 'فطور' },
  { title_en: 'Kids Menu', title_ar: 'قائمة أطفال' },
  { title_en: 'Combos', title_ar: 'كومبو' },
  { title_en: 'Extras', title_ar: 'إضافات' },
  { title_en: 'Soups', title_ar: 'شوربات' },
  { title_en: 'Juices', title_ar: 'عصائر' },
  { title_en: 'Hot Drinks', title_ar: 'مشروبات ساخنة' },
  { title_en: 'Cold Drinks', title_ar: 'مشروبات باردة' },
]

/** Grocery / Market: supermarket-style sections (e.g. Baladi, Shufersal). */
export const GROCERY_MENU_SECTIONS: MenuSection[] = [
  { title_en: 'Fruits & Vegetables', title_ar: 'فواكه وخضروات' },
  { title_en: 'Dairy & Eggs', title_ar: 'ألبان وبيض' },
  { title_en: 'Bakery & Pastries', title_ar: 'مخبوزات ومعجنات' },
  { title_en: 'Meat & Poultry', title_ar: 'لحوم ودواجن' },
  { title_en: 'Frozen Foods', title_ar: 'أطعمة مجمدة' },
  { title_en: 'Beverages', title_ar: 'مشروبات' },
  { title_en: 'Snacks & Sweets', title_ar: 'وجبات خفيفة وحلويات' },
  { title_en: 'Canned & Pantry', title_ar: 'معلبات ومؤن' },
  { title_en: 'Rice & Grains', title_ar: 'أرز وحبوب' },
  { title_en: 'Oil & Condiments', title_ar: 'زيوت وتوابل' },
  { title_en: 'Cleaning & Household', title_ar: 'تنظيف ومنزل' },
  { title_en: 'Personal Care', title_ar: 'العناية الشخصية' },
  { title_en: 'Baby & Kids', title_ar: 'أطفال ورضع' },
  { title_en: 'Organic', title_ar: 'عضوي' },
]

/** Retail / Shop: general retail sections. */
export const RETAIL_MENU_SECTIONS: MenuSection[] = [
  { title_en: 'New Arrivals', title_ar: 'وصل جديد' },
  { title_en: 'Best Sellers', title_ar: 'الأكثر مبيعاً' },
  { title_en: 'Seasonal', title_ar: 'موسمي' },
  { title_en: 'Accessories', title_ar: 'إكسسوارات' },
  { title_en: 'Gifts', title_ar: 'هدايا' },
  { title_en: 'Extras', title_ar: 'إضافات' },
]

/** Pharmacy: health & wellness sections. */
export const PHARMACY_MENU_SECTIONS: MenuSection[] = [
  { title_en: 'Medications', title_ar: 'أدوية' },
  { title_en: 'Vitamins & Supplements', title_ar: 'فيتامينات ومكملات' },
  { title_en: 'Personal Care', title_ar: 'العناية الشخصية' },
  { title_en: 'Baby Care', title_ar: 'العناية بالرضع' },
  { title_en: 'First Aid', title_ar: 'إسعافات أولية' },
  { title_en: 'Medical Devices', title_ar: 'أجهزة طبية' },
]

/** Map business type to its common menu sections. Fallback to restaurant for unknown types. */
export function getCommonMenuSections(businessType: string): MenuSection[] {
  switch (businessType) {
    case 'grocery':
    case 'supermarket':
    case 'greengrocer':
      return GROCERY_MENU_SECTIONS
    case 'retail':
      return RETAIL_MENU_SECTIONS
    case 'pharmacy':
      return PHARMACY_MENU_SECTIONS
    case 'restaurant':
    case 'cafe':
    case 'bakery':
    default:
      return RESTAURANT_MENU_SECTIONS
  }
}

/** @deprecated Use getCommonMenuSections(businessType) instead. Kept for backward compatibility. */
export const COMMON_MENU_SECTIONS = RESTAURANT_MENU_SECTIONS
