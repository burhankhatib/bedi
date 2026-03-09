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
} from 'react-icons/md'

import {
  FaDrumstickBite,
  FaFish,
  FaLeaf,
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
} from 'react-icons/fa'

const SECTION_ICON_MAP: Record<string, IconType> = {
  // Pizza & Italian
  pizza: MdLocalPizza,
  pizzas: MdLocalPizza,
  pasta: MdRestaurantMenu,
  italian: MdLocalPizza,

  // Burgers & sandwiches
  burger: MdLunchDining,
  burgers: MdLunchDining,
  hamburger: MdLunchDining,
  hamburgers: MdLunchDining,
  sandwiches: MdLunchDining,
  sandwich: MdLunchDining,
  shawarma: FaHotdog,
  toasts: MdLunchDining,
  hotdog: FaHotdog,
  hotdogs: FaHotdog,

  // Chicken & meat
  chicken: FaDrumstickBite,
  'chicken wings': FaDrumstickBite,
  wings: FaDrumstickBite,
  broasted: FaDrumstickBite,
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
  salads: FaLeaf,
  salad: FaLeaf,
  healthy: MdEco,
  vegan: FaLeaf,
  vegetarian: FaLeaf,

  // Groceries & Retail & Pharmacy
  grocery: MdLocalGroceryStore,
  supermarket: MdLocalGroceryStore,
  'mini-market': MdStore,
  'mini market': MdStore,
  organic: MdEco,
  dairy: FaCheese,
  'fruits-vegetables': FaAppleAlt,
  'fruits vegetables': FaAppleAlt,
  fruits: FaAppleAlt,
  vegetables: FaCarrot,
  produce: FaAppleAlt,
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
  { keyword: 'burger', icon: MdLunchDining },
  { keyword: 'sandwich', icon: MdLunchDining },
  { keyword: 'shawarma', icon: FaHotdog },
  { keyword: 'chicken', icon: FaDrumstickBite },
  { keyword: 'broast', icon: FaDrumstickBite },
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
  { keyword: 'salad', icon: FaLeaf },
  { keyword: 'soup', icon: MdSoupKitchen },
  { keyword: 'vegan', icon: FaLeaf },
  { keyword: 'health', icon: MdEco },
  { keyword: 'organic', icon: MdEco },
  { keyword: 'fruit', icon: FaAppleAlt },
  { keyword: 'veg', icon: FaCarrot },
  { keyword: 'bread', icon: MdBakeryDining },
  { keyword: 'bake', icon: MdBakeryDining },
  { keyword: 'break', icon: MdFreeBreakfast },
  { keyword: 'kid', icon: MdChildCare },
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
