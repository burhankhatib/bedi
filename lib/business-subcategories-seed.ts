/**
 * Business sub-category seed data. Shared by seed script and admin API.
 * DoorDash/Talabat-style cuisines and specialties.
 */

export type SubcategoryRow = { slug: string; title_en: string; title_ar: string; sortOrder: number }

export const RESTAURANT_SUBCATEGORIES: SubcategoryRow[] = [
  { slug: 'donations', title_en: 'Donations', title_ar: 'تبرع', sortOrder: 0 },
  { slug: 'breakfast', title_en: 'Breakfast', title_ar: 'فطور', sortOrder: 1 },
  { slug: 'pastries', title_en: 'Pastries', title_ar: 'معجنات', sortOrder: 2 },
  { slug: 'burgers', title_en: 'Burgers', title_ar: 'برجر', sortOrder: 3 },
  { slug: 'shawarma', title_en: 'Shawarma', title_ar: 'شاورما', sortOrder: 4 },
  { slug: 'home-cooked', title_en: 'Home-cooked', title_ar: 'أكل بيتي', sortOrder: 5 },
  { slug: 'broasted', title_en: 'Broasted', title_ar: 'بروستد', sortOrder: 6 },
  { slug: 'healthy', title_en: 'Healthy', title_ar: 'صحي', sortOrder: 7 },
  { slug: 'toasts', title_en: 'Toasts', title_ar: 'توستات', sortOrder: 8 },
  { slug: 'grills', title_en: 'Grills', title_ar: 'مشاوي', sortOrder: 9 },
  { slug: 'oriental-sweets', title_en: 'Oriental sweets', title_ar: 'حلو شرقي', sortOrder: 10 },
  { slug: 'gateau', title_en: 'Gateau', title_ar: 'جاتوه', sortOrder: 11 },
  { slug: 'drinks', title_en: 'Drinks', title_ar: 'مشروبات', sortOrder: 12 },
  { slug: 'asian', title_en: 'Asian', title_ar: 'آسيوي', sortOrder: 13 },
  { slug: 'pizza', title_en: 'Pizza', title_ar: 'بيتزا', sortOrder: 14 },
  { slug: 'sandwiches', title_en: 'Sandwiches', title_ar: 'شطائر', sortOrder: 15 },
  { slug: 'falafel', title_en: 'Falafel', title_ar: 'فلافل', sortOrder: 16 },
  { slug: 'fried-chicken', title_en: 'Fried Chicken', title_ar: 'دجاج مقلي', sortOrder: 17 },
  { slug: 'seafood', title_en: 'Seafood', title_ar: 'مأكولات بحرية', sortOrder: 18 },
  { slug: 'mexican', title_en: 'Mexican', title_ar: 'مكسيكي', sortOrder: 19 },
  { slug: 'indian', title_en: 'Indian', title_ar: 'هندي', sortOrder: 20 },
  { slug: 'salads', title_en: 'Salads', title_ar: 'سلطات', sortOrder: 21 },
  { slug: 'mezze', title_en: 'Mezze', title_ar: 'مازات', sortOrder: 22 },
  { slug: 'juices', title_en: 'Juices', title_ar: 'عصائر', sortOrder: 23 },
  { slug: 'ice-cream', title_en: 'Ice Cream', title_ar: 'آيس كريم', sortOrder: 24 },
  { slug: 'wraps', title_en: 'Wraps', title_ar: 'لفائف', sortOrder: 25 },
  { slug: 'rice-dishes', title_en: 'Rice Dishes', title_ar: 'أطباق أرز', sortOrder: 26 },
  { slug: 'soups', title_en: 'Soups', title_ar: 'شوربات', sortOrder: 27 },
  { slug: 'mandi', title_en: 'Mandi', title_ar: 'مندي', sortOrder: 28 },
  { slug: 'kabsa', title_en: 'Kabsa', title_ar: 'كبسة', sortOrder: 29 },
  { slug: 'manakeesh', title_en: 'Manakeesh', title_ar: 'مناقيش', sortOrder: 30 },
  { slug: 'kunafa', title_en: 'Kunafa', title_ar: 'كنافة', sortOrder: 31 },
  { slug: 'baklava', title_en: 'Baklava', title_ar: 'بقلاوة', sortOrder: 32 },
  { slug: 'hummus', title_en: 'Hummus & Dips', title_ar: 'حمص ومقبلات', sortOrder: 33 },
  { slug: 'lebanese', title_en: 'Lebanese', title_ar: 'لبناني', sortOrder: 34 },
  { slug: 'turkish', title_en: 'Turkish', title_ar: 'تركي', sortOrder: 35 },
  { slug: 'egyptian', title_en: 'Egyptian', title_ar: 'مصري', sortOrder: 36 },
  { slug: 'sushi', title_en: 'Sushi', title_ar: 'سوشي', sortOrder: 37 },
  { slug: 'japanese', title_en: 'Japanese', title_ar: 'ياباني', sortOrder: 38 },
  { slug: 'korean', title_en: 'Korean', title_ar: 'كوري', sortOrder: 39 },
  { slug: 'thai', title_en: 'Thai', title_ar: 'تايلاندي', sortOrder: 40 },
  { slug: 'mediterranean', title_en: 'Mediterranean', title_ar: 'متوسطي', sortOrder: 41 },
  { slug: 'vegan', title_en: 'Vegan', title_ar: 'نباتي', sortOrder: 42 },
  { slug: 'vegetarian', title_en: 'Vegetarian', title_ar: 'نباتي صرف', sortOrder: 43 },
  { slug: 'wings', title_en: 'Chicken Wings', title_ar: 'أجنحة دجاج', sortOrder: 44 },
  { slug: 'barbecue', title_en: 'Barbecue', title_ar: 'باربكيو', sortOrder: 45 },
  { slug: 'noodles', title_en: 'Noodles', title_ar: 'نودلز', sortOrder: 46 },
  { slug: 'ramen', title_en: 'Ramen', title_ar: 'رامن', sortOrder: 47 },
  { slug: 'donuts', title_en: 'Donuts', title_ar: 'دونات', sortOrder: 48 },
  { slug: 'desserts', title_en: 'Desserts', title_ar: 'حلويات', sortOrder: 49 },
  { slug: 'snacks', title_en: 'Snacks', title_ar: 'وجبات خفيفة', sortOrder: 50 },
  { slug: 'italian', title_en: 'Italian', title_ar: 'إيطالي', sortOrder: 51 },
  { slug: 'chinese', title_en: 'Chinese', title_ar: 'صيني', sortOrder: 52 },
  { slug: 'greek', title_en: 'Greek', title_ar: 'يوناني', sortOrder: 53 },
  { slug: 'vietnamese', title_en: 'Vietnamese', title_ar: 'فيتنامي', sortOrder: 54 },
  { slug: 'american', title_en: 'American', title_ar: 'أمريكي', sortOrder: 55 },
  { slug: 'french', title_en: 'French', title_ar: 'فرنسي', sortOrder: 56 },
  { slug: 'middle-eastern', title_en: 'Middle Eastern', title_ar: 'شرق أوسطي', sortOrder: 57 },
  { slug: 'spanish', title_en: 'Spanish', title_ar: 'إسباني', sortOrder: 58 },
  { slug: 'pakistani', title_en: 'Pakistani', title_ar: 'باكستاني', sortOrder: 59 },
  { slug: 'caribbean', title_en: 'Caribbean', title_ar: 'كاريبي', sortOrder: 60 },
]

export const CAFE_SUBCATEGORIES: SubcategoryRow[] = [
  { slug: 'coffee', title_en: 'Coffee', title_ar: 'قهوة', sortOrder: 0 },
  { slug: 'tea', title_en: 'Tea', title_ar: 'شاي', sortOrder: 1 },
  { slug: 'smoothies', title_en: 'Smoothies', title_ar: 'سموذي', sortOrder: 2 },
  { slug: 'desserts', title_en: 'Desserts', title_ar: 'حلويات', sortOrder: 3 },
  { slug: 'light-meals', title_en: 'Light meals', title_ar: 'وجبات خفيفة', sortOrder: 4 },
  { slug: 'breakfast', title_en: 'Breakfast', title_ar: 'فطور', sortOrder: 5 },
  { slug: 'pastries', title_en: 'Pastries', title_ar: 'معجنات', sortOrder: 6 },
  { slug: 'juices', title_en: 'Juices', title_ar: 'عصائر', sortOrder: 7 },
  { slug: 'ice-cream', title_en: 'Ice Cream', title_ar: 'آيس كريم', sortOrder: 8 },
  { slug: 'sandwiches', title_en: 'Sandwiches', title_ar: 'شطائر', sortOrder: 9 },
  { slug: 'salads', title_en: 'Salads', title_ar: 'سلطات', sortOrder: 10 },
]

export const BAKERY_SUBCATEGORIES: SubcategoryRow[] = [
  { slug: 'bread', title_en: 'Bread', title_ar: 'خبز', sortOrder: 0 },
  { slug: 'pastries', title_en: 'Pastries', title_ar: 'معجنات', sortOrder: 1 },
  { slug: 'cakes', title_en: 'Cakes', title_ar: 'كيك', sortOrder: 2 },
  { slug: 'oriental-sweets', title_en: 'Oriental sweets', title_ar: 'حلو شرقي', sortOrder: 3 },
  { slug: 'savory', title_en: 'Savory', title_ar: 'مخبوزات مالحة', sortOrder: 4 },
  { slug: 'manakeesh', title_en: 'Manakeesh', title_ar: 'مناقيش', sortOrder: 5 },
  { slug: 'cookies', title_en: 'Cookies', title_ar: 'كوكيز', sortOrder: 6 },
]

export const GROCERY_SUBCATEGORIES: SubcategoryRow[] = [
  { slug: 'supermarket', title_en: 'Supermarket', title_ar: 'سوبرماركت', sortOrder: 0 },
  { slug: 'mini-market', title_en: 'Mini market', title_ar: 'ميني ماركت', sortOrder: 1 },
  { slug: 'organic', title_en: 'Organic', title_ar: 'عضوي', sortOrder: 2 },
  { slug: 'dairy', title_en: 'Dairy', title_ar: 'ألبان', sortOrder: 3 },
  { slug: 'fruits-vegetables', title_en: 'Fruits & vegetables', title_ar: 'فواكه وخضروات', sortOrder: 4 },
]

export const RETAIL_SUBCATEGORIES: SubcategoryRow[] = [
  { slug: 'clothing', title_en: 'Clothing', title_ar: 'ملابس', sortOrder: 0 },
  { slug: 'electronics', title_en: 'Electronics', title_ar: 'إلكترونيات', sortOrder: 1 },
  { slug: 'gifts', title_en: 'Gifts', title_ar: 'هدايا', sortOrder: 2 },
  { slug: 'other', title_en: 'Other', title_ar: 'أخرى', sortOrder: 3 },
]

export const PHARMACY_SUBCATEGORIES: SubcategoryRow[] = [
  { slug: 'full', title_en: 'Full pharmacy', title_ar: 'صيدلية كاملة', sortOrder: 0 },
  { slug: 'mini', title_en: 'Mini pharmacy', title_ar: 'صيدلية مصغرة', sortOrder: 1 },
  { slug: 'other', title_en: 'Other', title_ar: 'أخرى', sortOrder: 2 },
]

export const OTHER_SUBCATEGORIES: SubcategoryRow[] = [
  { slug: 'other', title_en: 'Other', title_ar: 'أخرى', sortOrder: 0 },
]

export const BY_BUSINESS_TYPE: Record<string, SubcategoryRow[]> = {
  restaurant: RESTAURANT_SUBCATEGORIES,
  cafe: CAFE_SUBCATEGORIES,
  bakery: BAKERY_SUBCATEGORIES,
  grocery: GROCERY_SUBCATEGORIES,
  supermarket: GROCERY_SUBCATEGORIES,
  greengrocer: GROCERY_SUBCATEGORIES,
  retail: RETAIL_SUBCATEGORIES,
  pharmacy: PHARMACY_SUBCATEGORIES,
  other: OTHER_SUBCATEGORIES,
}
