import { defineField, defineType } from 'sanity'

/** Simpler Hero banner for homepage. Scrolls horizontally. Can be image or text-based. */
export const heroBannerType = defineType({
  name: 'heroBanner',
  title: 'Hero Banner',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Internal Name',
      type: 'string',
      description: 'Name this banner (e.g. "Summer promo"). Shown in the Studio list.',
    }),
    defineField({
      name: 'language',
      title: 'Language (deprecated)',
      type: 'string',
      hidden: true,
      description: 'Unused. Banners show for every site language; text and images follow Arabic/English fields.',
    }),
    defineField({
      name: 'bannerType',
      title: 'Banner Type',
      type: 'string',
      options: {
        list: [
          { title: 'Image Banner', value: 'image' },
          { title: 'Text Banner', value: 'text' },
        ],
      },
      initialValue: 'image',
    }),

    // --- IMAGE FIELDS (Arabic = default; English optional, falls back to Arabic) ---
    defineField({
      name: 'imageDesktopAr',
      title: 'Desktop — Arabic (500×280, default)',
      type: 'image',
      options: { hotspot: true },
      hidden: ({ parent }) => parent?.bannerType !== 'image',
      description: 'Default desktop art. Shown for Arabic and for English if no English desktop image is set.',
    }),
    defineField({
      name: 'imageDesktopEn',
      title: 'Desktop — English (500×280, optional)',
      type: 'image',
      options: { hotspot: true },
      hidden: ({ parent }) => parent?.bannerType !== 'image',
      description: 'Optional. When the site is in English, this is used if set; otherwise the Arabic desktop image is used.',
    }),
    defineField({
      name: 'imageMobileAr',
      title: 'Mobile — Arabic (320×180, optional)',
      type: 'image',
      options: { hotspot: true },
      hidden: ({ parent }) => parent?.bannerType !== 'image',
      description: 'Optional mobile crop. Falls back to Arabic desktop image if empty.',
    }),
    defineField({
      name: 'imageMobileEn',
      title: 'Mobile — English (320×180, optional)',
      type: 'image',
      options: { hotspot: true },
      hidden: ({ parent }) => parent?.bannerType !== 'image',
      description: 'Optional. Falls back to Arabic mobile, then English desktop, then Arabic desktop.',
    }),
    defineField({
      name: 'imageDesktop',
      title: 'Legacy desktop image',
      type: 'image',
      options: { hotspot: true },
      hidden: true,
      description: 'Old field. Treated as Arabic desktop if Arabic desktop is empty.',
    }),
    defineField({
      name: 'imageMobile',
      title: 'Legacy mobile image',
      type: 'image',
      options: { hotspot: true },
      hidden: true,
      description: 'Old field. Treated as Arabic mobile if Arabic mobile is empty.',
    }),

    // --- TEXT FIELDS ---
    defineField({
      name: 'textTitleAr',
      title: 'Title (Arabic)',
      type: 'string',
      hidden: ({ parent }) => parent?.bannerType !== 'text',
    }),
    defineField({
      name: 'textTitleEn',
      title: 'Title (English)',
      type: 'string',
      hidden: ({ parent }) => parent?.bannerType !== 'text',
    }),
    defineField({
      name: 'textDescriptionAr',
      title: 'Description (Arabic)',
      type: 'text',
      hidden: ({ parent }) => parent?.bannerType !== 'text',
    }),
    defineField({
      name: 'textDescriptionEn',
      title: 'Description (English)',
      type: 'text',
      hidden: ({ parent }) => parent?.bannerType !== 'text',
    }),
    defineField({
      name: 'textButtonLabelAr',
      title: 'Button Label (Arabic)',
      type: 'string',
      hidden: ({ parent }) => parent?.bannerType !== 'text',
    }),
    defineField({
      name: 'textButtonLabelEn',
      title: 'Button Label (English)',
      type: 'string',
      hidden: ({ parent }) => parent?.bannerType !== 'text',
    }),
    defineField({
      name: 'backgroundColor',
      title: 'Background Color Code (e.g. #3b82f6 or name)',
      type: 'string',
      initialValue: '#111827',
      hidden: ({ parent }) => parent?.bannerType !== 'text',
      description: 'Valid CSS color value.',
    }),
    defineField({
      name: 'textColor',
      title: 'Text Color Code',
      type: 'string',
      initialValue: '#ffffff',
      hidden: ({ parent }) => parent?.bannerType !== 'text',
      description: 'Valid CSS color value.',
    }),

    // --- LINKING ---
    defineField({
      name: 'linkType',
      title: 'Link To',
      type: 'string',
      options: {
        list: [
          { title: 'Business (tenant)', value: 'tenant' },
          { title: 'External URL', value: 'url' },
          { title: 'None', value: 'none' },
        ],
      },
      initialValue: 'none',
    }),
    defineField({
      name: 'tenant',
      title: 'Business',
      type: 'reference',
      to: [{ type: 'tenant' }],
      hidden: ({ parent }) => parent?.linkType !== 'tenant',
      description: 'Link to this business menu',
    }),
    defineField({
      name: 'url',
      title: 'External URL',
      type: 'url',
      hidden: ({ parent }) => parent?.linkType !== 'url',
    }),

    // --- TARGETING ---
    defineField({
      name: 'countries',
      title: 'Countries (filter)',
      type: 'array',
      of: [{ type: 'string' }],
      options: {
        list: [
          { title: 'Palestine', value: 'palestine' },
          { title: 'Jerusalem', value: 'jerusalem' },
        ],
      },
      description: 'Leave empty to show everywhere.',
    }),
    defineField({
      name: 'cities',
      title: 'Cities (filter)',
      type: 'array',
      of: [{ type: 'string' }],
      description: 'Leave empty to show in all cities.',
    }),

    // --- SCHEDULING / ORDERING ---
    defineField({
      name: 'sortOrder',
      title: 'Sort Order',
      type: 'number',
      initialValue: 0,
      description: 'Lower = first.',
    }),
    defineField({
      name: 'startDate',
      title: 'Start Date & Time',
      type: 'datetime',
      description: 'Optional',
    }),
    defineField({
      name: 'endDate',
      title: 'End Date & Time',
      type: 'datetime',
      description: 'Optional',
    }),
  ],
  preview: {
    select: {
      title: 'title',
      type: 'bannerType',
      mediaAr: 'imageDesktopAr',
      mediaLeg: 'imageDesktop',
    },
    prepare(selection) {
      const { title, type, mediaAr, mediaLeg } = selection ?? {}
      return {
        title: title || 'Untitled Banner',
        subtitle: type === 'text' ? 'Text Banner' : 'Image Banner',
        media: type === 'image' ? mediaAr || mediaLeg : undefined,
      }
    },
  },
  orderings: [
    { title: 'Sort Order (asc)', name: 'sortOrderAsc', by: [{ field: 'sortOrder', direction: 'asc' }] },
  ],
})
