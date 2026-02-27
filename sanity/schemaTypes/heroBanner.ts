import { defineField, defineType } from 'sanity'

/** Hero banner for homepage. Rotates with others. Can link to business (tenant) or external URL. */
export const heroBannerType = defineType({
  name: 'heroBanner',
  title: 'Hero Banner',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Banner name',
      type: 'string',
      description: 'Name this banner (e.g. "Summer promo", "New restaurant"). Shown in the Studio list.',
    }),
    defineField({
      name: 'language',
      title: 'Language',
      type: 'string',
      options: {
        list: [
          { title: 'Arabic', value: 'ar' },
          { title: 'English', value: 'en' },
        ],
      },
      initialValue: 'ar',
      description: 'Banner language. Default is Arabic. If no English banner exists, Arabic is shown.',
    }),
    defineField({
      name: 'imageDesktopAr',
      title: 'Desktop Image (Arabic)',
      type: 'image',
      options: { hotspot: true },
      description: 'Desktop banner in Arabic. Fallback for all if only this is set.',
    }),
    defineField({
      name: 'imageDesktopEn',
      title: 'Desktop Image (English)',
      type: 'image',
      options: { hotspot: true },
      description: 'Desktop banner in English. Falls back to Arabic if empty.',
    }),
    defineField({
      name: 'imageMobileAr',
      title: 'Mobile Image (Arabic)',
      type: 'image',
      options: { hotspot: true },
      description: 'Mobile banner in Arabic. Falls back to desktop if empty.',
    }),
    defineField({
      name: 'imageMobileEn',
      title: 'Mobile Image (English)',
      type: 'image',
      options: { hotspot: true },
      description: 'Mobile banner in English. Falls back to Arabic, then desktop.',
    }),
    defineField({
      name: 'image',
      title: 'Legacy Image (fallback)',
      type: 'image',
      options: { hotspot: true },
      hidden: true,
      description: 'Old single image. Used only when none of the 4 size/language images exist.',
    }),
    defineField({
      name: 'videoDesktopAr',
      title: 'Desktop Video (Arabic)',
      type: 'file',
      options: { accept: 'video/mp4,video/webm,video/ogg' },
      description: 'Desktop banner video in Arabic. Same fallback order as images. Shown muted, autoplay, loop. Prefer MP4 for compatibility.',
    }),
    defineField({
      name: 'videoDesktopEn',
      title: 'Desktop Video (English)',
      type: 'file',
      options: { accept: 'video/mp4,video/webm,video/ogg' },
      description: 'Desktop banner video in English. Falls back to Arabic if empty.',
    }),
    defineField({
      name: 'videoMobileAr',
      title: 'Mobile Video (Arabic)',
      type: 'file',
      options: { accept: 'video/mp4,video/webm,video/ogg' },
      description: 'Mobile banner video in Arabic. Falls back to desktop if empty.',
    }),
    defineField({
      name: 'videoMobileEn',
      title: 'Mobile Video (English)',
      type: 'file',
      options: { accept: 'video/mp4,video/webm,video/ogg' },
      description: 'Mobile banner video in English. Falls back to Arabic, then desktop.',
    }),
    defineField({
      name: 'linkType',
      title: 'Link Type',
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
      description: 'Link to this business menu (e.g. /t/[slug])',
    }),
    defineField({
      name: 'url',
      title: 'External URL',
      type: 'url',
      hidden: ({ parent }) => parent?.linkType !== 'url',
      description: 'Full URL when clicked (e.g. https://...)',
    }),
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
      description: 'Leave empty to show in all locations. Otherwise, only show when user country matches.',
    }),
    defineField({
      name: 'cities',
      title: 'Cities (filter)',
      type: 'array',
      of: [{ type: 'string' }],
      description: 'Leave empty to show in all cities. Otherwise, only show when user city matches.',
    }),
    defineField({
      name: 'height',
      title: 'Banner Height (fallback)',
      type: 'string',
      options: {
        list: [
          { title: 'Small (420px)', value: 'small' },
          { title: 'Medium (560px)', value: 'medium' },
          { title: 'Large (780px)', value: 'large' },
          { title: 'Full (1080px)', value: 'full' },
        ],
      },
      initialValue: 'medium',
      description: 'Used when preferred dimensions are not set. Height on desktop. Mobile fallback 420px.',
    }),
    defineField({
      name: 'preferredDesktopWidth',
      title: 'Preferred Desktop Width',
      type: 'number',
      description: 'Display width in pixels for desktop. Banner is shown at 100% viewport width; this is used for aspect ratio so nothing is cropped.',
      validation: (Rule) => Rule.min(1).max(4096),
    }),
    defineField({
      name: 'preferredDesktopHeight',
      title: 'Preferred Desktop Height',
      type: 'number',
      description: 'Display height in pixels for desktop. With width, sets aspect ratio (height/width).',
      validation: (Rule) => Rule.min(1).max(4096),
    }),
    defineField({
      name: 'preferredMobileWidth',
      title: 'Preferred Mobile Width',
      type: 'number',
      description: 'Display width in pixels for mobile. Used for aspect ratio on small screens.',
      validation: (Rule) => Rule.min(1).max(2048),
    }),
    defineField({
      name: 'preferredMobileHeight',
      title: 'Preferred Mobile Height',
      type: 'number',
      description: 'Display height in pixels for mobile. With width, sets aspect ratio.',
      validation: (Rule) => Rule.min(1).max(2048),
    }),
    defineField({
      name: 'sortOrder',
      title: 'Sort Order',
      type: 'number',
      initialValue: 0,
      description: 'Lower = first. Use for controlling rotation order.',
    }),
    defineField({
      name: 'startDate',
      title: 'Start Date & Time',
      type: 'datetime',
      description: 'When to start showing this banner. Leave empty to show immediately.',
    }),
    defineField({
      name: 'endDate',
      title: 'End Date & Time',
      type: 'datetime',
      description: 'When to stop showing this banner. Leave empty to show indefinitely.',
    }),
  ],
  preview: {
    select: {
      title: 'title',
      language: 'language',
      linkType: 'linkType',
      tenant: 'tenant.name',
      url: 'url',
      startDate: 'startDate',
      endDate: 'endDate',
      media: 'imageDesktopAr',
    },
    prepare(selection) {
      const { title, language, linkType, tenant, url, startDate, endDate, media } = selection ?? {}
      if (title) {
        const dateSuffix = startDate || endDate ? ' (scheduled)' : ''
        return { title: `${title}${dateSuffix}`, media }
      }
      const link =
        linkType === 'tenant' ? `→ ${tenant ?? 'Business'}` : linkType === 'url' ? `→ ${url ?? 'URL'}` : 'No link'
      const langSuffix = language === 'en' ? ' (EN)' : language === 'ar' ? ' (AR)' : ''
      const dateSuffix = startDate || endDate ? ' (scheduled)' : ''
      return {
        title: `${link}${langSuffix}${dateSuffix}`,
        media,
      }
    },
  },
  orderings: [
    { title: 'Sort Order (asc)', name: 'sortOrderAsc', by: [{ field: 'sortOrder', direction: 'asc' }] },
  ],
})
