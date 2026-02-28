import { defineField, defineType } from 'sanity'

export const driverType = defineType({
  name: 'driver',
  title: 'Driver (Captain)',
  type: 'document',
  fields: [
    defineField({
      name: 'site',
      title: 'Site (legacy)',
      type: 'reference',
      to: [{ type: 'tenant' }],
      description: 'Legacy: if set, driver was created by this tenant. New drivers use country/city and are shared.',
    }),
    defineField({
      name: 'country',
      title: 'Country code',
      type: 'string',
      description: 'Country (e.g. PS, IL). Drivers are shared with tenants in the same country and city.',
    }),
    defineField({
      name: 'city',
      title: 'City',
      type: 'string',
      description: 'City name. Used for “drivers in your area” quick-add.',
    }),
    defineField(    {
      name: 'clerkUserId',
      title: 'Clerk user ID',
      type: 'string',
      description: 'Set when driver joins via “Join as a driver”; links profile to their account.',
      readOnly: true,
    }),
    defineField({
      name: 'name',
      title: 'Full Name',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'nickname',
      title: 'Preferred Nickname',
      type: 'string',
      description: 'Name to display (e.g. for orders). Leave empty to use full name.',
    }),
    defineField({
      name: 'age',
      title: 'Age',
      type: 'number',
      validation: (Rule) => Rule.min(18).max(120),
    }),
    defineField({
      name: 'picture',
      title: 'Personal Picture',
      type: 'image',
      options: { hotspot: true },
    }),
    defineField({
      name: 'gender',
      title: 'Gender',
      type: 'string',
      options: {
        list: [
          { title: 'Male', value: 'male' },
          { title: 'Female', value: 'female' },
          { title: 'Other', value: 'other' },
          { title: 'Prefer not to say', value: 'prefer_not_to_say' },
        ],
      },
    }),
    defineField({
      name: 'phoneNumber',
      title: 'WhatsApp Phone Number',
      type: 'string',
      validation: (Rule) =>
        Rule.required()
          .custom((phone) => {
            if (!phone) return true
            const cleaned = (phone || '').replace(/\D/g, '')
            if (!cleaned.length) return 'Phone number is required'
            return true
          }),
      description: 'Phone number with country code (e.g., +972501234567)',
      placeholder: '+972501234567',
    }),
    defineField({
      name: 'normalizedPhone',
      title: 'Normalized phone (digits only)',
      type: 'string',
      description: 'Set automatically for matching when a driver registers with the same number as a tenant-added placeholder.',
      readOnly: true,
      hidden: true,
    }),
    defineField({
      name: 'isActive',
      title: 'Active',
      type: 'boolean',
      initialValue: true,
      description: 'Enable or disable this driver',
    }),
    defineField({
      name: 'vehicleType',
      title: 'Vehicle Type',
      type: 'string',
      options: {
        list: [
          { title: 'Car', value: 'car' },
          { title: 'Motorcycle', value: 'motorcycle' },
          { title: 'Bicycle', value: 'bicycle' },
          { title: 'Scooter', value: 'scooter' },
        ],
      },
    }),
    defineField({
      name: 'vehicleNumber',
      title: 'Vehicle Number (if applicable)',
      type: 'string',
      description: 'License plate or vehicle registration number.',
    }),
    defineField({
      name: 'rulesAcknowledged',
      title: 'Rules & rights acknowledged',
      type: 'boolean',
      initialValue: false,
      description: 'Driver confirmed they read and agree to the website rules and rights.',
      validation: (Rule) => Rule.required().custom((v) => (v === true ? true : 'You must acknowledge the rules to register.')),
    }),
    defineField({
      name: 'deliveryAreas',
      title: 'Delivery Areas',
      type: 'array',
      of: [{ type: 'reference', to: [{ type: 'area' }] }],
      description: 'Areas this driver can deliver to',
    }),
    defineField({
      name: 'notes',
      title: 'Notes',
      type: 'text',
      rows: 3,
      description: 'Internal notes about the driver',
    }),
    defineField({
      name: 'isOnline',
      title: 'Online status',
      type: 'boolean',
      initialValue: false,
      description: 'Driver must be online to receive delivery requests. Visible to tenants in same country/city.',
    }),
    defineField({
      name: 'lastSeenAt',
      title: 'Last seen at',
      type: 'datetime',
      description: 'Updated when driver toggles status or opens the app',
      readOnly: true,
    }),
    defineField({
      name: 'onlineSince',
      title: 'Online since',
      type: 'datetime',
      description: 'Set when driver goes online; cleared when going offline. Used for online duration.',
      readOnly: true,
    }),
    defineField({
      name: 'pushSubscription',
      title: 'Push subscription (Web Push)',
      type: 'object',
      readOnly: true,
      hidden: true,
      fields: [
        { name: 'endpoint', type: 'string' },
        { name: 'p256dh', type: 'string' },
        { name: 'auth', type: 'string' },
      ],
      description: 'Web Push subscription for delivery notifications (set by driver app). Used when FCM is not configured.',
    }),
    defineField({
      name: 'fcmToken',
      title: 'FCM token',
      type: 'string',
      readOnly: true,
      hidden: true,
      description: 'Firebase Cloud Messaging token for push notifications (set by driver app when Firebase is configured).',
    }),
    defineField({
      name: 'lastKnownLat',
      title: 'Last known latitude',
      type: 'number',
      readOnly: true,
      hidden: true,
      description: 'Last shared location latitude. Updated when driver shares location while online.',
    }),
    defineField({
      name: 'lastKnownLng',
      title: 'Last known longitude',
      type: 'number',
      readOnly: true,
      hidden: true,
      description: 'Last shared location longitude.',
    }),
    defineField({
      name: 'lastLocationAt',
      title: 'Last location updated at',
      type: 'datetime',
      readOnly: true,
      hidden: true,
      description: 'When the driver last shared their location.',
    }),
    defineField({
      name: 'lastOfflineReminderAt',
      title: 'Last offline reminder sent at',
      type: 'datetime',
      readOnly: true,
      hidden: true,
      description: 'Tracks when the last "go online" FCM reminder was sent. Used to throttle reminders to once per 4 hours.',
    }),
    defineField({
      name: 'blockedBySuperAdmin',
      title: 'Blocked by Super Admin',
      type: 'boolean',
      initialValue: false,
      description: 'Super admin only: when true, this driver cannot sign in or receive delivery requests. They cannot override this.',
    }),
  ],
  preview: {
    select: {
      name: 'name',
      phoneNumber: 'phoneNumber',
      vehicleType: 'vehicleType',
      country: 'country',
      city: 'city',
      firstAreaName: 'deliveryAreas.0.name_en',
      picture: 'picture',
    },
    prepare(selection) {
      const { name, phoneNumber, vehicleType, country, city, firstAreaName, picture } = selection ?? {}
      const driverName = typeof name === 'string' ? name : 'Unnamed'
      const vehicleLabel = typeof vehicleType === 'string'
        ? vehicleType.charAt(0).toUpperCase() + vehicleType.slice(1)
        : '—'
      const mobileLine = [typeof phoneNumber === 'string' ? phoneNumber : '—', vehicleLabel].join(' › ')
      const locationParts = [country, city, firstAreaName].map((s) => (typeof s === 'string' ? s : '—'))
      const locationLine = locationParts.join(' › ')
      const result = {
        title: driverName,
        subtitle: `${mobileLine} · ${locationLine}`,
      }
      if (picture) (result as { title: string; subtitle: string; media?: unknown }).media = picture
      return result
    },
  },
})
