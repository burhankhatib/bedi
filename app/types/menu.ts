export interface Category {
  _id: string
  title_en: string
  title_ar: string
  slug: {
    current: string
  }
  image?: {
    asset: {
      _ref: string
    }
  }
  sortOrder?: number
  /** How products are ordered: manual (sortOrder), name, or price. */
  productSortMode?: 'manual' | 'name' | 'price'
  /** When set, this category is a sub-category under the parent. */
  parentCategoryRef?: string
}

export interface ProductAddOn {
  name_en: string
  name_ar: string
  price: number
  _key?: string
}

export interface ProductVariantOption {
  label_en: string
  label_ar: string
  priceModifier?: number
  /** Optional sale price for this option. When set and not expired, used instead of priceModifier. */
  specialPriceModifier?: number
  /** When the special price for this option expires (ISO datetime). */
  specialPriceModifierExpires?: string
  /** Optional image for this option (e.g. color). When customer selects this option, show this image instead of product image. */
  image?: {
    asset?: { _ref?: string }
  }
  /** When true, this option is pre-selected when the customer opens the product. One per group. */
  isDefault?: boolean
}

export interface ProductVariantGroup {
  name_en: string
  name_ar: string
  /** When true, customer must pick one option from this group. When false, the group is optional (e.g. "Make it a Meal"). */
  required?: boolean
  options: ProductVariantOption[]
}

export interface Product {
  _id: string
  title_en: string
  title_ar: string
  description_en?: string
  description_ar?: string
  ingredients_en?: string[]
  ingredients_ar?: string[]
  price: number
  /** How the item is sold: piece, kg, g, liter, ml, pack, box, bottle, can, bag, dozen, jar. */
  saleUnit?: string
  hidePrice?: boolean
  specialPrice?: number
  specialPriceExpires?: string
  currency: string
  image?: {
    asset: {
      _ref: string
    }
  }
  additionalImages?: Array<{
    asset: {
      _ref: string
    }
  }>
  category: {
    _ref: string
  }
  sortOrder?: number
  isPopular?: boolean
  isAvailable?: boolean
  availableAgainAt?: string
  dietaryTags?: string[]
  addOns?: ProductAddOn[]
  variants?: ProductVariantGroup[]
}

/** One day's hours (open/close as "HH:mm" or "" for closed). Index 0 = Sunday, 6 = Saturday. */
export interface DayHours {
  open?: string
  close?: string
  shifts?: { open?: string; close?: string }[]
}

export interface CustomDateHours {
  date?: string // YYYY-MM-DD
  open?: string
  close?: string
  shifts?: { open?: string; close?: string }[]
}

export interface RestaurantInfo {
  name_en: string
  name_ar: string
  tagline_en?: string
  tagline_ar?: string
  logo?: any
  address_en?: string
  address_ar?: string
  /** Optional link to open in Maps (e.g. Google Maps link). When set, "Visit us" section is shown. */
  mapsLink?: string
  /** Google Maps embed iframe src URL. When set, embedded map is shown. How to get it: Google Maps → your location → Share → Embed a map → copy the iframe's src=... value. */
  mapEmbedUrl?: string
  socials?: {
    facebook?: string
    instagram?: string
    tiktok?: string
    snapchat?: string
    whatsapp?: string
    website?: string
  }
  /** Length 7: [Sun, Mon, Tue, Wed, Thu, Fri, Sat]. Empty open/close = closed. */
  openingHours?: DayHours[] | null
  customDateHours?: CustomDateHours[] | null
}

export interface AboutUs {
  title_en: string
  title_ar: string
  content_en?: string
  content_ar?: string
  image?: any
}

export interface MenuData extends Category {
  products: Product[]
}

export interface InitialData {
  categories: MenuData[]
  popularProducts: Product[]
  restaurantInfo: RestaurantInfo | null
  aboutUs: AboutUs | null
  /** Store name from tenant (e.g. "B Cafe"). Used in header when restaurantInfo is missing. */
  storeName?: string | null
  /** When true, show "Dine-in" (table) option; when false, only "Receive in Person" (pickup) + Delivery. */
  supportsDineIn?: boolean
  /** When true, show "Receive in Person" (pickup) option. When false with no Dine-in and no delivery, menu is catalog only. */
  supportsReceiveInPerson?: boolean
  /** When true, tenant has at least one active delivery area (show Delivery option). */
  hasDelivery?: boolean
  /** When true, customer sees free delivery and the business pays the driver delivery fee. */
  freeDeliveryEnabled?: boolean
  /** When true, business is manually closed (deactivated until deactivateUntil). Customer can still browse catalog. */
  isManuallyClosed?: boolean
  /** When set with isManuallyClosed, business reopens at this ISO date/time. For banner "We will open again on...". */
  deactivateUntil?: string | null
  /** Business country code (e.g. IL, PS) for timezone; open/closed and countdown use business local time. */
  businessCountry?: string | null
  /** Whether to hide prices for products when in catalog mode */
  catalogHidePrices?: boolean
  locationLat?: number | null
  locationLng?: number | null
  deliveryPricingMode?: 'areas' | 'distance'
  deliveryFeeMin?: number
  deliveryFeeMax?: number
  requiresPersonalShopper?: boolean
  supportsDriverPickup?: boolean
  shopperFee?: number
  tenantId?: string
}
