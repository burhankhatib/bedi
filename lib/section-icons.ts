/**
 * Maps specialty/section keys (lowercase, from API) to Material Design and Font Awesome icons for the search page.
 * Used for the horizontal Specialty strip with circular icon chips (Material You).
 */
import type { IconType } from 'react-icons'
import {
  MdRestaurant,
  MdLocalPizza,
  MdLunchDining,
  MdDinnerDining,
  MdCake,
  MdCookie,
  MdFreeBreakfast,
  MdLocalCafe,
  MdLocalBar,
  MdEmojiFoodBeverage,
  MdTapas,
  MdRamenDining,
  MdBakeryDining,
  MdKebabDining,
  MdRestaurantMenu,
  MdIcecream,
  MdSoupKitchen,
  MdChildCare,
  MdAddCircleOutline,
  MdEco,
  MdSetMeal,
  MdFastfood,
  MdLocalDining,
  MdStore,
  MdLocalMall,
  MdLocalGroceryStore,
  MdLocalPharmacy,
  MdMonitorHeart,
  MdCheckroom,
  MdDevices,
  MdCardGiftcard,
  MdGrass,
  MdPets,
  MdCleaningServices,
  MdSpa,
  MdLocalGasStation,
  MdWaterDrop,
} from 'react-icons/md'

import { GiNoodles, GiDonerKebab, GiRoastChicken } from 'react-icons/gi'

import {
  FaDrumstickBite,
  FaFish,
  FaCarrot,
  FaAppleAlt,
  FaIceCream,
  FaHotdog,
  FaCheese,
  FaCandyCane,
  FaCocktail,
  FaGlassCheers,
  FaMugHot,
  FaShoppingBasket,
  FaShoppingCart,
  FaUtensils,
  FaFireAlt,
  FaStoreAlt,
  FaSeedling,
  FaCookieBite,
} from 'react-icons/fa'

const SECTION_ICON_MAP: Record<string, IconType> = {
  // Pizza & Italian (pizza icon only for pizza; Italian / pasta → noodles)
  pizza: MdLocalPizza,
  pizzas: MdLocalPizza,
  pasta: GiNoodles,
  italian: GiNoodles,
  italy: GiNoodles,

  // Burgers & sandwiches
  burger: MdLunchDining,
  burgers: MdLunchDining,
  hamburger: MdLunchDining,
  hamburgers: MdLunchDining,
  sandwiches: MdLunchDining,
  sandwich: MdLunchDining,
  shawarma: FaHotdog,
  toasts: GiDonerKebab,
  toast: GiDonerKebab,
  wraps: GiDonerKebab,
  wrap: GiDonerKebab,
  hotdog: FaHotdog,
  hotdogs: FaHotdog,

  // Chicken & meat
  chicken: FaDrumstickBite,
  'chicken wings': FaDrumstickBite,
  wings: FaDrumstickBite,
  broasted: GiRoastChicken,
  broast: GiRoastChicken,
  kebab: MdKebabDining,
  kebabs: MdKebabDining,
  meat: MdDinnerDining,
  grill: FaFireAlt,
  grills: FaFireAlt,

  // Seafood
  seafood: FaFish,
  fish: FaFish,
  sushi: MdRamenDining,
  asian: MdRamenDining,
  japanese: MdRamenDining,
  korean: MdRamenDining,
  thai: MdRamenDining,
  ramen: MdRamenDining,
  noodles: MdRamenDining,

  // MENA specialties
  mandi: MdSetMeal,
  kabsa: MdSetMeal,
  manakeesh: MdBakeryDining,
  kunafa: FaCandyCane,
  baklava: FaCandyCane,
  falafel: MdTapas,
  hummus: MdTapas,
  mezze: MdTapas,
  lebanese: MdRestaurant,
  turkish: MdRestaurant,
  egyptian: MdRestaurant,

  // More cuisines & formats
  mexican: MdLocalDining,
  indian: MdRestaurantMenu,
  mediterranean: MdRestaurant,
  barbecue: FaFireAlt,
  'fried-chicken': FaDrumstickBite,
  'rice-dishes': MdSetMeal,
  donuts: MdCake,
  snacks: FaCookieBite,
  snack: FaCookieBite,

  // Mains & dishes
  'main dishes': MdDinnerDining,
  mains: MdDinnerDining,
  'main course': MdDinnerDining,
  dishes: MdDinnerDining,
  dinner: MdDinnerDining,
  lunch: MdLunchDining,
  meals: MdSetMeal,
  'home cooked': MdSoupKitchen,
  'home-cooked': MdSoupKitchen,
  'light meals': MdLocalDining,
  'light-meals': MdLocalDining,

  // Appetizers & sides
  appetizers: MdTapas,
  appetizer: MdTapas,
  tapas: MdTapas,
  sides: MdBakeryDining,
  side: MdBakeryDining,
  starters: MdTapas,
  starter: MdTapas,

  // Desserts & sweets
  desserts: MdCake,
  dessert: MdCake,
  cake: MdCake,
  cakes: MdCake,
  cookies: MdCookie,
  cookie: MdCookie,
  icecream: FaIceCream,
  'ice cream': FaIceCream,
  sweets: FaCandyCane,
  gateau: MdCake,
  gatea: MdCake,
  'oriental sweets': FaCandyCane,
  'oriental-sweets': FaCandyCane,
  pastries: MdBakeryDining,

  // Drinks
  drinks: FaCocktail,
  beverages: MdLocalBar,
  'hot drinks': FaMugHot,
  'cold drinks': FaGlassCheers,
  coffee: MdLocalCafe,
  tea: FaMugHot,
  juices: MdEmojiFoodBeverage,
  juice: MdEmojiFoodBeverage,
  smoothies: MdEmojiFoodBeverage,
  smoothie: MdEmojiFoodBeverage,

  // Breakfast & bakery
  breakfast: MdFreeBreakfast,
  bakery: MdBakeryDining,
  bread: MdBakeryDining,
  savory: MdBakeryDining,

  // Soups & salads
  soups: MdSoupKitchen,
  soup: MdSoupKitchen,
  salads: MdGrass,
  salad: MdGrass,
  healthy: MdEco,
  vegan: FaSeedling,
  vegetarian: FaCarrot,

  // Groceries & Retail & Pharmacy
  grocery: MdLocalGroceryStore,
  greengrocer: FaCarrot,
  greengrocery: FaCarrot,
  butcher: FaStoreAlt,
  gas: MdLocalGasStation,
  water: MdWaterDrop,
  supermarket: MdLocalGroceryStore,
  'mini-market': MdStore,
  'mini market': MdStore,
  organic: MdEco,
  dairy: FaCheese,
  'fruits-vegetables': FaAppleAlt,
  'fruits vegetables': FaAppleAlt,
  'fresh produce': FaAppleAlt,
  fruits: FaAppleAlt,
  vegetables: FaCarrot,
  produce: FaAppleAlt,
  'dairy eggs': FaCheese,
  'dairy & eggs': FaCheese,
  'baked goods': MdBakeryDining,
  'meats chicken fish': FaDrumstickBite,
  'meats chicken & fish': FaDrumstickBite,
  'frozen products': FaIceCream,
  'frozen foods': FaIceCream,
  'drinks juices': MdEmojiFoodBeverage,
  'drinks & juices': MdEmojiFoodBeverage,
  'sweets snacks': FaCandyCane,
  'sweets & snacks': FaCandyCane,
  'ready meals': MdSetMeal,
  'ready meals appetizers': MdSetMeal,
  'cereals breakfast': MdFreeBreakfast,
  'cereals & breakfast': MdFreeBreakfast,
  'grocery pantry': MdLocalGroceryStore,
  'grocery & pantry': MdLocalGroceryStore,
  'rice grains': MdStore,
  'rice & grains': MdStore,
  'oil condiments': MdLocalGroceryStore,
  'cleaning hygiene': MdCleaningServices,
  'cleaning household': MdCleaningServices,
  'health beauty': MdSpa,
  'health & beauty': MdSpa,
  'personal hygiene': MdSpa,
  'personal care': MdSpa,
  'health specialized diets': MdEco,
  'health & specialized diets': MdEco,
  'pet products': MdPets,
  'baby kids': MdChildCare,
  retail: MdLocalMall,
  clothing: MdCheckroom,
  electronics: MdDevices,
  gifts: MdCardGiftcard,
  pharmacy: MdLocalPharmacy,
  full: MdLocalPharmacy,
  mini: MdLocalPharmacy,
  donations: MdCardGiftcard,

  // Other
  combos: MdFastfood,
  combo: MdFastfood,
  extras: MdAddCircleOutline,
  'kids menu': MdChildCare,
  kids: MdChildCare,
  'kids meals': MdChildCare,
  other: MdAddCircleOutline,
}

// Order matters: more specific keywords first
const KEYWORD_FALLBACKS: Array<{ keyword: string; icon: IconType }> = [
  { keyword: 'pizza', icon: MdLocalPizza },
  { keyword: 'italian', icon: GiNoodles },
  { keyword: 'italy', icon: GiNoodles },
  { keyword: 'pasta', icon: GiNoodles },
  { keyword: 'burger', icon: MdLunchDining },
  { keyword: 'vegetarian', icon: FaCarrot },
  { keyword: 'veggie', icon: FaCarrot },
  { keyword: 'vegan', icon: FaSeedling },
  { keyword: 'wrap', icon: GiDonerKebab },
  { keyword: 'toast', icon: GiDonerKebab },
  { keyword: 'snack', icon: FaCookieBite },
  { keyword: 'sandwich', icon: MdLunchDining },
  { keyword: 'shawarma', icon: FaHotdog },
  { keyword: 'broast', icon: GiRoastChicken },
  { keyword: 'chicken', icon: FaDrumstickBite },
  { keyword: 'fish', icon: FaFish },
  { keyword: 'seafood', icon: FaFish },
  { keyword: 'grill', icon: FaFireAlt },
  { keyword: 'meat', icon: MdDinnerDining },
  { keyword: 'steak', icon: MdDinnerDining },
  { keyword: 'kebab', icon: MdKebabDining },
  { keyword: 'cake', icon: MdCake },
  { keyword: 'sweet', icon: FaCandyCane },
  { keyword: 'dessert', icon: MdCake },
  { keyword: 'ice cream', icon: FaIceCream },
  { keyword: 'coffee', icon: MdLocalCafe },
  { keyword: 'tea', icon: FaMugHot },
  { keyword: 'drink', icon: FaCocktail },
  { keyword: 'juice', icon: MdEmojiFoodBeverage },
  { keyword: 'smooth', icon: MdEmojiFoodBeverage },
  { keyword: 'salad', icon: MdGrass },
  { keyword: 'soup', icon: MdSoupKitchen },
  { keyword: 'health', icon: MdEco },
  { keyword: 'organic', icon: MdEco },
  { keyword: 'pet', icon: MdPets },
  { keyword: 'cleaning', icon: MdCleaningServices },
  { keyword: 'beauty', icon: MdSpa },
  { keyword: 'hygiene', icon: MdSpa },
  { keyword: 'frozen', icon: FaIceCream },
  { keyword: 'fruit', icon: FaAppleAlt },
  { keyword: 'veg', icon: FaCarrot },
  { keyword: 'bread', icon: MdBakeryDining },
  { keyword: 'bake', icon: MdBakeryDining },
  { keyword: 'break', icon: MdFreeBreakfast },
  { keyword: 'kid', icon: MdChildCare },
  { keyword: 'mandi', icon: MdSetMeal },
  { keyword: 'kabsa', icon: MdSetMeal },
  { keyword: 'manakeesh', icon: MdBakeryDining },
  { keyword: 'kunafa', icon: FaCandyCane },
  { keyword: 'falafel', icon: MdTapas },
  { keyword: 'hummus', icon: MdTapas },
  { keyword: 'mezze', icon: MdTapas },
  { keyword: 'ramen', icon: MdRamenDining },
  { keyword: 'noodle', icon: MdRamenDining },
]

export function getSectionIcon(key: string): IconType {
  const normalized = (key ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
  
  // 1. Exact match
  if (SECTION_ICON_MAP[normalized]) {
    return SECTION_ICON_MAP[normalized]
  }

  // 2. Keyword fallback match
  for (const fallback of KEYWORD_FALLBACKS) {
    if (normalized.includes(fallback.keyword)) {
      return fallback.icon
    }
  }

  // 3. Default fallback
  return MdRestaurant
}

/**
 * Emoji for specialty chips. Uses slug + titles so CMS Arabic/English labels resolve even when slug is opaque.
 * Order matters: more specific phrases before broad keywords (e.g. vegan before vegetarian, broasted before chicken).
 */
export function getSectionEmoji(
  slug: string,
  titleEn?: string | null,
  titleAr?: string | null
): string {
  const H = [slug ?? '', titleEn ?? '', titleAr ?? '']
    .join(' ')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')

  if (H.includes('vegetarian') || H.includes('veggie')) return '🥕'
  if (H.includes('نباتي صرف') || (H.includes('vegan') && !H.includes('vegetarian'))) return '🌱'
  if (H.includes('نباتي')) return '🥕'

  if (H.includes('بروست') || H.includes('broast') || H.includes('broasted')) return '🐔'

  if (
    H.includes('دجاج مقلي') ||
    H.includes('fried chicken') ||
    H.includes('fried-chicken') ||
    (H.includes('fried') && H.includes('chicken'))
  )
    return '🍗'

  if (H.includes('pizza')) return '🍕'

  if (H.includes('برجر') || H.includes('burger') || H.includes('hamburger')) return '🍔'

  if (
    H.includes('إيطالي') ||
    H.includes('ايطالي') ||
    H.includes('italian') ||
    H.includes('italy')
  )
    return '🍝'

  if (H.includes('مكسيك') || H.includes('mexican') || H.includes('taco')) return '🌮'
  if (H.includes('هندي') || H.includes('indian') || H.includes('curry')) return '🍛'
  if (H.includes('صيني') || H.includes('chinese')) return '🥟'
  if (H.includes('ياباني') || H.includes('japanese')) return '🍱'
  if (H.includes('كوري') || H.includes('korean')) return '🍲'
  if (H.includes('تايلاندي') || H.includes('thai')) return '🍜'
  if (H.includes('فرنسي') || H.includes('french')) return '🥐'
  if (H.includes('لبناني') || H.includes('lebanese')) return '🥙'
  if (H.includes('تركي') || H.includes('turkish')) return '🫓'
  if (H.includes('مصري') || H.includes('egyptian')) return '🧆'
  if (H.includes('سوري') || H.includes('syrian')) return '🥙'
  if (H.includes('ألماني') || H.includes('german')) return '🥨'
  if (H.includes('يوناني') || H.includes('greek')) return '🫒'
  if (H.includes('إسبان') || H.includes('spanish')) return '🥘'
  if (H.includes('بريطان') || H.includes('british')) return '🫖'
  if ((H.includes('أمريكي') || H.includes('american')) && !H.includes('mexican')) return '🌭'

  if (
    H.includes('wrap') ||
    H.includes('burrito') ||
    H.includes('لفاف') ||
    H.includes('راب') ||
    H.includes('توست') ||
    H.includes('toast')
  )
    return '🌯'

  if (H.includes('شطائر') || H.includes('sandwich') || H.includes('shawarma')) return '🥪'

  if (H.includes('خفيفة') || H.includes('light meal') || H.includes('light-meal')) return '🍱'
  if (H.includes('snack') || H.includes('مقرمشات')) return '🍪'

  if (H.includes('سلطة') || H.includes('salad')) return '🥗'

  if (H.includes('صحي') || H.includes('healthy')) return '🥑'

  if (H.includes('مشاو') || H.includes('grill') || H.includes('bbq') || H.includes('barbecue')) return '🥩'

  if (H.includes('كباب') || H.includes('kebab')) return '🍢'

  if (H.includes('chicken') || H.includes('wing') || H.includes('دجاج')) return '🍗'

  if (H.includes('meat') || H.includes('steak')) return '🥩'

  if ((H.includes('seafood') || H.includes('fish')) && !H.includes('sushi')) return '🐟'
  if (H.includes('sushi')) return '🍣'
  if (H.includes('asian') || H.includes('ramen') || H.includes('noodle')) return '🍜'

  if (H.includes('soup')) return '🥣'
  if (H.includes('dessert') || H.includes('cake') || H.includes('sweet') || H.includes('baklava') || H.includes('kunafa'))
    return '🍰'
  if (H.includes('ice cream')) return '🍦'
  if (H.includes('cookie')) return '🍪'
  if (H.includes('coffee') || H.includes('cafe')) return '☕'
  if (H.includes('tea')) return '🍵'
  if (H.includes('مشروب') || H.includes('drink') || H.includes('beverage') || H.includes('juice') || H.includes('smooth'))
    return '🥤'
  if (H.includes('فطور') || H.includes('breakfast')) return '🍳'
  if (H.includes('bakery') || H.includes('bread') || H.includes('manakeesh') || H.includes('pastries')) return '🥐'
  if (H.includes('falafel')) return '🧆'

  if (H.includes('grocery') || H.includes('market') || H.includes('supermarket')) return '🛒'
  if (H.includes('fruit') || H.includes('veg') || H.includes('produce')) return '🍎'
  if (H.includes('dairy') || H.includes('cheese')) return '🧀'
  if (H.includes('pharmacy') || H.includes('medicine')) return '💊'
  if (H.includes('cleaning') || H.includes('hygiene')) return '🧼'
  if (H.includes('beauty') || H.includes('spa')) return '💄'
  if (H.includes('pet')) return '🐾'
  if (H.includes('electronics')) return '📱'
  if (H.includes('clothing') || H.includes('retail')) return '👕'
  if (H.includes('gift')) return '🎁'
  if (H.includes('acclaimed') || H.includes('featured') || H.includes('popular')) return '🏆'

  return '🍽️'
}

