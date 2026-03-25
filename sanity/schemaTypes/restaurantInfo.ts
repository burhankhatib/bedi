import { defineField, defineType } from 'sanity'
import { SoundPreviewInput } from '../components/SoundPreviewInput'

export const restaurantInfoType = defineType({
  name: 'restaurantInfo',
  title: 'Business Info',
  type: 'document',
  fields: [
    defineField({
      name: 'site',
      title: 'Site',
      type: 'reference',
      to: [{ type: 'tenant' }],
      description: 'Which business/site this belongs to',
    }),
    defineField({
      name: 'name_en',
      title: 'Name (English)',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'name_ar',
      title: 'Name (Arabic)',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'tagline_en',
      title: 'Tagline (English)',
      type: 'string',
    }),
    defineField({
      name: 'tagline_ar',
      title: 'Tagline (Arabic)',
      type: 'string',
    }),
    defineField({
      name: 'logo',
      title: 'Logo',
      type: 'image',
      options: { hotspot: true },
      description: 'Used for PWA icon and manifest. Recommended for new businesses.',
    }),
    defineField({
      name: 'address_en',
      title: 'Address (English)',
      type: 'string',
    }),
    defineField({
      name: 'address_ar',
      title: 'Address (Arabic)',
      type: 'string',
    }),
    defineField({
      name: 'mapsLink',
      title: 'Maps link (optional)',
      type: 'url',
      description: 'Link to open your location in Google Maps or Apple Maps (e.g. from Share in Google Maps). When set, the "Visit us" section is shown with this link.',
    }),
    defineField({
      name: 'mapEmbedUrl',
      title: 'Embed Google Maps (optional)',
      type: 'string',
      description: 'How to get it: 1) Open Google Maps and find your location. 2) Click Share → Embed a map. 3) Copy the iframe code, then paste either the full iframe HTML or just the src URL (the part inside src="..."). When set, an embedded map is shown on your menu page.',
    }),
    defineField({
      name: 'wifiNetwork',
      title: 'WiFi Network Name (SSID)',
      type: 'string',
      description: 'The name of your business WiFi network. If provided, users can view or connect to it via the Table QR page.',
    }),
    defineField({
      name: 'wifiPassword',
      title: 'WiFi Password',
      type: 'string',
      description: 'The password for your business WiFi network.',
    }),
    defineField({
      name: 'socials',
      title: 'Social Media',
      type: 'object',
      fields: [
        defineField({ name: 'facebook', title: 'Facebook URL', type: 'url' }),
        defineField({ name: 'instagram', title: 'Instagram URL', type: 'url' }),
        defineField({ name: 'tiktok', title: 'TikTok URL', type: 'url' }),
        defineField({ name: 'snapchat', title: 'Snapchat URL', type: 'url' }),
        defineField({
          name: 'whatsapp',
          title: 'WhatsApp Number',
          type: 'string',
          description: 'Phone number with country code (e.g. 972501234567). Used for "Contact us" link.',
        }),
        defineField({ name: 'website', title: 'Website URL', type: 'url' }),
      ],
    }),
    defineField({
      name: 'openingHours',
      title: 'Opening & Closing Hours',
      type: 'array',
      description: 'Hours per day (index 0 = Sunday, 6 = Saturday). Empty open/close = closed that day.',
      initialValue: () => [],
      of: [
        {
          type: 'object',
          fields: [
            { name: 'open', type: 'string', title: 'Open (e.g. 09:00)', validation: (Rule) => Rule.max(5) },
            { name: 'close', type: 'string', title: 'Close (e.g. 22:00)', validation: (Rule) => Rule.max(5) },
            {
              name: 'shifts',
              title: 'Multiple Shifts',
              type: 'array',
              description: 'Optional: specify multiple opening periods for this day (e.g., 09:00-14:00, 18:00-23:00)',
              of: [
                {
                  type: 'object',
                  fields: [
                    { name: 'open', type: 'string', title: 'Open (e.g. 09:00)' },
                    { name: 'close', type: 'string', title: 'Close (e.g. 14:00)' },
                  ],
                },
              ],
            },
          ],
          preview: { select: { open: 'open', close: 'close' }, prepare: ({ open, close }) => ({ title: open && close ? `${open} – ${close}` : 'Closed' }) },
        },
      ],
      validation: (Rule) => Rule.max(7),
    }),
    defineField({
      name: 'customDateHours',
      title: 'Custom hours (specific dates)',
      type: 'array',
      description: 'Override hours for specific dates (e.g. holidays).',
      initialValue: () => [],
      of: [
        {
          type: 'object',
          fields: [
            { name: 'date', type: 'string', title: 'Date (YYYY-MM-DD)' },
            { name: 'open', type: 'string', title: 'Open' },
            { name: 'close', type: 'string', title: 'Close' },
            {
              name: 'shifts',
              title: 'Multiple Shifts',
              type: 'array',
              description: 'Optional: specify multiple opening periods for this date',
              of: [
                {
                  type: 'object',
                  fields: [
                    { name: 'open', type: 'string', title: 'Open (e.g. 09:00)' },
                    { name: 'close', type: 'string', title: 'Close (e.g. 14:00)' },
                  ],
                },
              ],
            },
          ],
        },
      ],
    }),
    defineField({
      name: 'notificationSound',
      title: 'Order Notification Sound',
      type: 'string',
      description: 'Choose the sound that plays when a new order is received on the Orders page. Click "Play" to preview each sound.',
      components: {
        input: SoundPreviewInput,
      },
      initialValue: '1.wav',
      validation: (Rule) => Rule.required(),
    }),
  ],
  preview: {
    select: {
      name_en: 'name_en',
      name_ar: 'name_ar',
      businessType: 'site.businessType',
      city: 'site.city',
      country: 'site.country',
      logo: 'logo',
    },
    prepare(selection) {
      const { name_en, name_ar, businessType, city, country, logo } = selection ?? {}
      const businessName = typeof name_en === 'string' ? name_en : (typeof name_ar === 'string' ? name_ar : 'Untitled')
      const typeLabel = typeof businessType === 'string'
        ? businessType.charAt(0).toUpperCase() + businessType.slice(1).replace(/_/g, ' ')
        : '—'
      const locParts = [city, country].filter(Boolean).map((s) => (typeof s === 'string' ? s : '—'))
      const location = locParts.length > 0 ? locParts.join(', ') : '—'
      const result = {
        title: businessName,
        subtitle: `${typeLabel} · ${location}`,
      }
      if (logo) (result as { title: string; subtitle: string; media?: unknown }).media = logo
      return result
    },
  },
})
