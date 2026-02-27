/**
 * Maps specialty/section keys (lowercase, from API) to Material Design icons for the search page.
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
} from 'react-icons/md'

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

  // Chicken & meat
  chicken: MdKebabDining,
  'chicken wings': MdKebabDining,
  wings: MdKebabDining,
  kebab: MdKebabDining,
  kebabs: MdKebabDining,
  meat: MdDinnerDining,
  grill: MdKebabDining,

  // Mains & dishes
  'main dishes': MdDinnerDining,
  mains: MdDinnerDining,
  'main course': MdDinnerDining,
  dishes: MdDinnerDining,
  dinner: MdDinnerDining,
  lunch: MdLunchDining,
  meals: MdSetMeal,

  // Appetizers & sides
  appetizers: MdTapas,
  appetizer: MdTapas,
  tapas: MdTapas,
  sides: MdBakeryDining,
  side: MdBakeryDining,

  // Desserts & sweets
  desserts: MdCake,
  dessert: MdCake,
  cake: MdCake,
  cakes: MdCake,
  cookies: MdCookie,
  cookie: MdCookie,
  icecream: MdIcecream,
  'ice cream': MdIcecream,
  sweets: MdCake,

  // Drinks
  drinks: MdLocalBar,
  beverages: MdLocalBar,
  'hot drinks': MdLocalCafe,
  'cold drinks': MdEmojiFoodBeverage,
  coffee: MdLocalCafe,
  tea: MdLocalCafe,
  juices: MdEmojiFoodBeverage,
  juice: MdEmojiFoodBeverage,
  smoothies: MdEmojiFoodBeverage,
  smoothie: MdEmojiFoodBeverage,

  // Breakfast & bakery
  breakfast: MdFreeBreakfast,
  bakery: MdBakeryDining,
  bread: MdBakeryDining,

  // Soups & salads
  soups: MdSoupKitchen,
  soup: MdSoupKitchen,
  salads: MdEco,
  salad: MdEco,

  // Other
  combos: MdRestaurantMenu,
  combo: MdRestaurantMenu,
  extras: MdAddCircleOutline,
  'kids menu': MdChildCare,
  kids: MdChildCare,
  'kids meals': MdChildCare,
}

export function getSectionIcon(key: string): IconType {
  const normalized = (key ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
  return SECTION_ICON_MAP[normalized] ?? MdRestaurant
}
