import { defineField, defineType } from 'sanity'

/** One tenant = one business (restaurant, cafe, etc.) in the SaaS */
export const tenantType = defineType({
  name: 'tenant',
  title: 'Tenant (Site)',
  type: 'document',
  fields: [
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      description: 'URL slug for this site (e.g. my-restaurant). Used in /t/[slug]',
      options: {
        source: 'name',
        maxLength: 96,
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'name',
      title: 'Business Name',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'name_ar',
      title: 'Business Name (Arabic)',
      type: 'string',
      description: 'Arabic name for the business (e.g. for driver push notifications and RTL display).',
    }),
    defineField({
      name: 'country',
      title: 'Country',
      type: 'string',
      description: 'Required for delivery: used to manage and share drivers by area.',
    }),
    defineField({
      name: 'city',
      title: 'City',
      type: 'string',
      description: 'Required for delivery: used to manage and share drivers in this city.',
    }),
    defineField({
      name: 'locationLat',
      title: 'Business latitude',
      type: 'number',
      description: 'GPS latitude of the business location. Used by drivers and customers to navigate here. Set via "Share Location" in the business settings.',
    }),
    defineField({
      name: 'locationLng',
      title: 'Business longitude',
      type: 'number',
      description: 'GPS longitude of the business location.',
    }),
    defineField({
      name: 'businessType',
      title: 'Business Type',
      type: 'string',
      description: 'Matches Business Category value in CMS (e.g. restaurant, cafe).',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'businessSubcategories',
      title: 'Sub-categories (Specialties)',
      type: 'array',
      of: [
        {
          type: 'reference',
          to: [{ type: 'businessSubcategory' }],
          options: {
            filter: ({ document }) => ({
              filter: 'businessType == $businessType',
              params: { businessType: (document?.businessType as string) ?? '' },
            }),
          },
        },
      ],
      description: 'Optional. A business can have multiple specialties (e.g. Burgers, Sandwiches, Pizza). Only sub-categories for the selected Business Type are shown.',
    }),
    defineField({
      name: 'prioritizeWhatsapp',
      title: 'Instant WhatsApp (legacy toggle)',
      type: 'boolean',
      initialValue: false,
      description:
        'Deprecated: new orders now always trigger the business new_order WhatsApp template when recipients exist. The ~3 minute unaccepted reminder still runs automatically. This field is kept for backward compatibility only.',
    }),
    defineField({
      name: 'deliveryPricingMode',
      title: 'Delivery Pricing Mode',
      type: 'string',
      options: {
        list: [
          { title: 'Distance-based (Automatic)', value: 'distance' },
        ],
      },
      initialValue: 'distance',
      readOnly: true,
      hidden: true,
      description: 'Delivery fees use distance-based pricing.',
    }),
    defineField({
      name: 'deliveryFeeMin',
      title: 'Minimum Delivery Fee',
      type: 'number',
      description: 'Minimum fee for distance-based delivery (e.g. 10).',
    }),
    defineField({
      name: 'deliveryFeeMax',
      title: 'Maximum Delivery Fee',
      type: 'number',
      description: 'Maximum fee for distance-based delivery (e.g. 25).',
    }),
    defineField({
      name: 'deliveryMaxDistanceKm',
      title: 'Maximum Distance (km) for Fee Scaling',
      type: 'number',
      description: 'Distance at which the fee reaches the maximum (e.g. 15).',
    }),
    defineField({
      name: 'clerkUserId',
      title: 'Clerk User ID',
      type: 'string',
      description: 'Owner: Clerk user ID who created this tenant',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'clerkUserEmail',
      title: 'Owner Email',
      type: 'string',
      description: 'Primary owner email from Clerk. Set automatically when creating a tenant from the app (onboarding or Super Admin). Used for display and for dashboard/access by email.',
    }),
    defineField({
      name: 'ownerPhone',
      title: 'Owner Phone',
      type: 'string',
      description: 'Owner’s mobile/WhatsApp number. Required at signup so the tenant can place orders without Clerk phone verification. Stored in E.164 or with country code (e.g. +972501234567).',
    }),
    defineField({
      name: 'normalizedOwnerPhone',
      title: 'Normalized owner phone (digits)',
      type: 'string',
      description: 'Digits-only form for matching when placing orders. Set automatically.',
      readOnly: true,
      hidden: true,
    }),
    defineField({
      name: 'coOwnerEmails',
      title: 'Additional owner emails',
      type: 'array',
      of: [{ type: 'string' }],
      description: 'Other people who can manage this business (store lowercase). Same access as primary owner.',
    }),
    defineField({
      name: 'subscriptionStatus',
      title: 'Subscription Status',
      type: 'string',
      options: {
        list: [
          { title: 'Trial', value: 'trial' },
          { title: 'Active', value: 'active' },
          { title: 'Past Due', value: 'past_due' },
          { title: 'Cancelled', value: 'cancelled' },
        ],
      },
      initialValue: 'trial',
    }),
    defineField({
      name: 'subscriptionPlan',
      title: 'Subscription Plan Tier',
      type: 'string',
      description: 'basic | pro | ultra. Trial = ultra for 30 days. Set when tenant pays via BOP.',
      options: {
        list: [
          { title: 'Trial (Ultra)', value: 'ultra' },
          { title: 'Basic', value: 'basic' },
          { title: 'Pro', value: 'pro' },
          { title: 'Ultra', value: 'ultra' },
        ],
      },
    }),
    defineField({
      name: 'createdAt',
      title: 'Created At',
      type: 'datetime',
      initialValue: () => new Date().toISOString(),
    }),
    defineField({
      name: 'businessCreatedAt',
      title: 'Business Created At',
      type: 'datetime',
      description: 'Set when the business profile (restaurantInfo) is first submitted. Used to start the 30-day trial.',
    }),
    defineField({
      name: 'lastSubscriptionReminderAt',
      title: 'Last subscription reminder sent at',
      type: 'datetime',
      description: 'Tracks when the last FCM expiration reminder was sent to avoid spamming.',
    }),
    defineField({
      name: 'subscriptionExpiresAt',
      title: 'Subscription expires at',
      type: 'datetime',
      description: 'End of 30-day trial (from site creation) or paid period. Business is hidden from customers when past this date. Set to createdAt + 30 days on create; extended when tenant subscribes or pays.',
    }),
    defineField({
      name: 'paypalSubscriptionId',
      title: 'PayPal subscription ID',
      type: 'string',
      description: 'Stored when tenant approves a PayPal recurring subscription. Used for webhooks to extend on each billing cycle.',
      readOnly: true,
    }),
    defineField({
      name: 'subscriptionLastPaymentAt',
      title: 'Last subscription payment at',
      type: 'datetime',
      description: 'Set when subscription is extended (approve or webhook). Used for display (last payment date).',
      readOnly: true,
    }),
    defineField({
      name: 'deactivated',
      title: 'Deactivated',
      type: 'boolean',
      initialValue: false,
      description: 'When true, the business is temporarily hidden (menu unavailable) until re-enabled or until deactivateUntil.',
    }),
    defineField({
      name: 'deactivateUntil',
      title: 'Re-enable at (date & time)',
      type: 'datetime',
      description: 'Optional. When set, the business will automatically become active again at this date and time (like product availability).',
    }),
    defineField({
      name: 'defaultLanguage',
      title: 'Default language (dashboard)',
      type: 'string',
      options: {
        list: [
          { title: 'Arabic', value: 'ar' },
          { title: 'English', value: 'en' },
        ],
      },
      description: 'Default language for your business dashboard (manage pages). Does not change the customer menu language.',
    }),
    defineField({
      name: 'catalogHidePrices',
      title: 'Hide Prices in Catalog Mode',
      type: 'boolean',
      initialValue: false,
      description: 'When catalog mode is active (no delivery, no pickup, no dine-in), hide all product prices.',
    }),
    defineField({
      name: 'supportsDineIn',
      title: 'Accept Dine-in orders',
      type: 'boolean',
      description: 'When on, customers can choose "Dine-in" (table) when ordering. When off, only Receive in Person and Delivery (if you have delivery areas) are shown.',
    }),
    defineField({
      name: 'supportsReceiveInPerson',
      title: 'Accept Receive in Person (pickup) orders',
      type: 'boolean',
      initialValue: true,
      description: 'When on, customers can choose "Receive in Person" (pickup). When off with Dine-in off and no delivery, the menu acts as a catalog only (no Add to Cart).',
    }),
    defineField({
      name: 'supportsDelivery',
      title: 'Offer Delivery',
      type: 'boolean',
      initialValue: true,
      description: 'When on and you have at least one delivery area, customers see the Delivery option. When off, customers never see Delivery even if you have areas. When on but no delivery areas, Delivery is still hidden until you add areas.',
    }),
    defineField({
      name: 'freeDeliveryEnabled',
      title: 'Free Delivery (Business Pays Driver)',
      type: 'boolean',
      initialValue: false,
      description: 'When enabled, customers see Free Delivery. Driver delivery fee is paid by the business, not collected from the customer.',
    }),
    defineField({
      name: 'supportsDriverPickup',
      title: 'Driver Pickup (Auto Dispatch)',
      type: 'boolean',
      initialValue: false,
      description: 'When enabled, new delivery orders are automatically sent to drivers (online and offline reminders) without manual "request driver" from the business.',
    }),
    defineField({
      name: 'prepTimeBucket',
      title: 'Preparation Time (Fastest filter)',
      type: 'string',
      options: {
        list: [
          { title: '10-20 minutes', value: '10-20' },
          { title: '20-30 minutes', value: '20-30' },
          { title: '30-40 minutes', value: '30-40' },
          { title: '40-50 minutes', value: '40-50' },
        ],
      },
      initialValue: '20-30',
      description: 'Average time needed to prepare most orders. Used with distance for the "Fastest" ETA filter.',
    }),
    defineField({
      name: 'defaultAutoDeliveryRequestMinutes',
      title: 'Default auto delivery request delay (minutes)',
      type: 'number',
      description:
        'Pre-select delay for “request drivers after…”. Null = none / manual only in UI unless tenant picks each time. 0 = immediately; 5–40 allowed.',
    }),
    defineField({
      name: 'saveAutoDeliveryRequestPreference',
      title: 'Save auto delivery request preference',
      type: 'boolean',
      initialValue: false,
      description: 'When true, new orders pre-fill the auto-request delay from defaultAutoDeliveryRequestMinutes.',
    }),
    defineField({
      name: 'businessLogo',
      title: 'Business logo',
      type: 'image',
      options: { hotspot: true },
      description: 'Used in Order list preview to identify the business. Synced from Business Info when you save there, or set here in Studio.',
    }),
    defineField({
      name: 'pushSubscription',
      title: 'Push subscription',
      type: 'object',
      description: 'Web Push subscription for new order notifications (set when tenant enables push on orders page).',
      hidden: ({ document }) => !!document?.deactivated,
      fields: [
        { name: 'endpoint', type: 'string', title: 'Endpoint' },
        { name: 'p256dh', type: 'string', title: 'p256dh key' },
        { name: 'auth', type: 'string', title: 'Auth key' },
      ],
    }),
    defineField({
      name: 'fcmToken',
      title: 'FCM token (legacy single)',
      type: 'string',
      description: 'Legacy: single FCM token. Prefer fcmTokens for multi-device support.',
      hidden: ({ document }) => !!document?.deactivated,
    }),
    defineField({
      name: 'fcmTokens',
      title: 'FCM tokens (all devices)',
      type: 'array',
      of: [{ type: 'string' }],
      description: 'One FCM token per device. When a device enables notifications, its token is added here so all devices receive new order and table-request notifications.',
      hidden: ({ document }) => !!document?.deactivated,
    }),
    defineField({
      name: 'blockedBySuperAdmin',
      title: 'Blocked by Super Admin',
      type: 'boolean',
      initialValue: false,
      description: 'Super admin only: when true, this business cannot access the control panel or receive new orders. They cannot override this.',
    }),
    defineField({
      name: 'requiresPersonalShopper',
      title: 'Requires Personal Shopper',
      type: 'boolean',
      initialValue: false,
      description: 'When enabled, the driver collects items at the store (e.g. supermarkets, greengrocers) instead of receiving a pre-packed order. A shopper fee is added to delivery orders.',
    }),
    defineField({
      name: 'shopperFee',
      title: 'Personal Shopper Fee (ILS)',
      type: 'number',
      initialValue: 10,
      description: 'Fee added to delivery orders when Requires Personal Shopper is enabled. Displayed as a time-saving service for the customer.',
      hidden: ({ parent }) => !parent?.requiresPersonalShopper,
    }),
  ],
  preview: {
    select: {
      name: 'name',
      slug: 'slug',
      city: 'city',
      country: 'country',
      businessType: 'businessType',
    },
    prepare(selection) {
      const { name, slug, city, country, businessType } = selection ?? {}
      const slugCurrent = slug && typeof slug === 'object' && 'current' in slug ? (slug as { current?: string }).current : undefined
      const businessName = typeof name === 'string' ? name : (typeof slugCurrent === 'string' ? slugCurrent : 'Unnamed')
      const locParts = [city, country].filter(Boolean).map((s) => (typeof s === 'string' ? s : '—'))
      const location = locParts.length > 0 ? locParts.join(' › ') : '—'
      const typeLabel = typeof businessType === 'string'
        ? businessType.charAt(0).toUpperCase() + businessType.slice(1).replace(/_/g, ' ')
        : '—'
      return {
        title: businessName,
        subtitle: `${location} · ${typeLabel}`,
      }
    },
  },
})
