import { defineQuery } from 'next-sanity'

export const MENU_QUERY = defineQuery(`{
  "categories": *[_type == "category"] | order(sortOrder asc) {
    _id,
    title_en,
    title_ar,
    slug,
    image,
    sortOrder,
    productSortMode,
    "products": *[_type == "product" && references(^._id)] | order(sortOrder asc) {
      _id,
      title_en,
      title_ar,
      description_en,
      description_ar,
      ingredients_en,
      ingredients_ar,
      price,
      saleUnit,
      hidePrice,
      specialPrice,
      specialPriceExpires,
      currency,
      image,
      additionalImages,
      isPopular,
      isAvailable,
      availableAgainAt,
      sortOrder,
      dietaryTags,
      addOns,
      variants
    }
  },
  "popularProducts": *[_type == "product" && isPopular == true] | order(sortOrder asc) [0...6] {
    _id,
    title_en,
    title_ar,
    description_en,
    description_ar,
    ingredients_en,
    ingredients_ar,
    price,
    saleUnit,
    specialPrice,
    specialPriceExpires,
    currency,
    image,
    additionalImages,
    isPopular,
    isAvailable,
    availableAgainAt,
    sortOrder,
    dietaryTags,
    addOns,
    variants
  },
  "restaurantInfo": *[_type == "restaurantInfo"][0] {
    name_en,
    name_ar,
    tagline_en,
    tagline_ar,
    logo,
    address_en,
    address_ar,
    socials
  },
  "aboutUs": *[_type == "aboutUs"][0] {
    title_en,
    title_ar,
    content_en,
    content_ar,
    image
  }
}`)

export const ORDERS_QUERY = defineQuery(`*[_type == "order"] | order(createdAt desc) {
  _id,
  orderNumber,
  orderType,
  status,
  customerName,
  tableNumber,
  customerPhone,
  deliveryArea->{_id, name_en, name_ar},
  deliveryAddress,
  deliveryFee,
  assignedDriver->{
    _id,
    name,
    phoneNumber,
    deliveryAreas[]->{_id, name_en, name_ar}
  },
  items,
  subtotal,
  totalAmount,
  currency,
  createdAt,
  completedAt
}`)

export const ANALYTICS_QUERY = defineQuery(`*[_type == "order"] {
  _id,
  orderNumber,
  orderType,
  status,
  customerName,
  items,
  totalAmount,
  deliveryFee,
  currency,
  createdAt,
  deliveryArea->{name_en}
}`)

export const NEW_ORDERS_QUERY = defineQuery(`*[_type == "order" && status == "new"] | order(createdAt desc) {
  _id,
  orderNumber,
  createdAt,
  orderType,
  customerName,
  customerPhone,
  tableNumber,
  deliveryAddress,
  deliveryArea->{_id, name_en, name_ar},
  deliveryLat,
  deliveryLng,
  totalAmount,
  currency
}`)

// Tenant-scoped: filter by site (tenant) ref. Use $siteId = tenant document _id.
// Categories must have a site; do not show categories with no site on any tenant.
// Other types support legacy docs without site: (site._ref == $siteId || !defined(site))
const siteFilter = '(site._ref == $siteId || !defined(site))'
const categorySiteFilter = 'site._ref == $siteId'

export const MENU_QUERY_TENANT = defineQuery(`{
  "categories": *[_type == "category" && ${categorySiteFilter}] | order(sortOrder asc) {
    _id,
    title_en,
    title_ar,
    slug,
    image,
    sortOrder,
    productSortMode,
    "parentCategoryRef": parentCategory._ref,
    "products": *[_type == "product" && references(^._id) && (site._ref == $siteId || !defined(site))] | order(sortOrder asc) {
      _id,
      title_en,
      title_ar,
      description_en,
      description_ar,
      ingredients_en,
      ingredients_ar,
      price,
      saleUnit,
      hidePrice,
      specialPrice,
      specialPriceExpires,
      currency,
      image,
      additionalImages,
      isPopular,
      isAvailable,
      availableAgainAt,
      sortOrder,
      dietaryTags,
      addOns,
      variants
    }
  },
  "popularProducts": *[_type == "product" && ${siteFilter} && isPopular == true] | order(sortOrder asc) [0...6] {
    _id,
    title_en,
    title_ar,
    description_en,
    description_ar,
    ingredients_en,
    ingredients_ar,
    price,
    saleUnit,
    specialPrice,
    specialPriceExpires,
    currency,
    image,
    additionalImages,
    isPopular,
    isAvailable,
    availableAgainAt,
    sortOrder,
    dietaryTags,
    addOns,
    variants
  },
  "restaurantInfo": *[_type == "restaurantInfo" && ${siteFilter}][0] {
    name_en,
    name_ar,
    tagline_en,
    tagline_ar,
    logo,
    address_en,
    address_ar,
    mapsLink,
    mapEmbedUrl,
    socials,
    openingHours,
    customDateHours
  },
  "aboutUs": *[_type == "aboutUs" && ${siteFilter}][0] {
    title_en,
    title_ar,
    content_en,
    content_ar,
    image
  }
}`)

export const ORDERS_QUERY_TENANT = defineQuery(`*[_type == "order" && ${siteFilter}] | order(createdAt desc) {
  _id,
  orderNumber,
  orderType,
  status,
  customerName,
  tableNumber,
  customerPhone,
  deliveryArea->{_id, name_en, name_ar},
  deliveryAddress,
  deliveryFee,
  assignedDriver->{
    _id,
    name,
    phoneNumber,
    deliveryAreas[]->{_id, name_en, name_ar}
  },
  items,
  subtotal,
  totalAmount,
  currency,
  createdAt,
  completedAt
}`)

export const NEW_ORDERS_QUERY_TENANT = defineQuery(`*[_type == "order" && ${siteFilter} && status == "new"] | order(createdAt desc) {
  _id,
  orderNumber,
  createdAt,
  orderType,
  customerName,
  customerPhone,
  tableNumber,
  deliveryAddress,
  deliveryArea->{_id, name_en, name_ar},
  deliveryLat,
  deliveryLng,
  totalAmount,
  currency
}`)

export const ANALYTICS_QUERY_TENANT = defineQuery(`*[_type == "order" && ${siteFilter}] {
  _id,
  orderNumber,
  orderType,
  status,
  customerName,
  items,
  totalAmount,
  deliveryFee,
  currency,
  createdAt,
  deliveryArea->{name_en},
  assignedDriver->{_id, name}
}`)

/** Tenants (sites) for the current user — by clerkUserId or by clerkUserEmail / coOwnerEmails (same registered email = same dashboard).
 * Pass clerkUserId and optionally clerkUserEmailLower (lowercase) to include tenants linked by email. */
export const TENANTS_FOR_USER_QUERY = defineQuery(`*[_type == "tenant" && (
  clerkUserId == $clerkUserId ||
  (defined($clerkUserEmailLower) && $clerkUserEmailLower != "" && (
    (defined(clerkUserEmail) && lower(clerkUserEmail) == $clerkUserEmailLower) ||
    (defined(coOwnerEmails) && $clerkUserEmailLower in coOwnerEmails)
  ))
)] | order(createdAt desc) {
  _id,
  "slug": slug.current,
  name,
  businessType,
  clerkUserId,
  clerkUserEmail,
  coOwnerEmails,
  subscriptionStatus,
  createdAt,
  "name_en": *[_type == "restaurantInfo" && site._ref == ^._id][0].name_en,
  "name_ar": *[_type == "restaurantInfo" && site._ref == ^._id][0].name_ar
}`)

/** Tenants where the user is a staff member (by email). Same shape as tenant list for dashboard. */
export const TENANTS_FOR_STAFF_QUERY = defineQuery(`*[_type == "tenant" && _id in *[_type == "tenantStaff" && lower(email) == $emailLower].site._ref] | order(createdAt desc) {
  _id,
  "slug": slug.current,
  name,
  businessType,
  subscriptionStatus,
  createdAt,
  "name_en": *[_type == "restaurantInfo" && site._ref == ^._id][0].name_en,
  "name_ar": *[_type == "restaurantInfo" && site._ref == ^._id][0].name_ar
}`)

/** All public tenant slugs for sitemap. Excludes blocked, deactivated, and expired tenants. */
export const SITEMAP_TENANTS_QUERY = defineQuery(`*[_type == "tenant" && defined(slug.current) && !blockedBySuperAdmin && !deactivated && (
  (subscriptionExpiresAt != null && subscriptionExpiresAt > now()) ||
  (subscriptionExpiresAt == null && (!defined(createdAt) || dateTime(createdAt) + 2592000 > now()))
)] | order(createdAt desc) { "slug": slug.current, _updatedAt }`)
