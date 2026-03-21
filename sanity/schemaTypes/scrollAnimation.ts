import { defineField, defineType } from 'sanity'
import { BulkImageUploadInput } from '../components/BulkImageUploadInput'
import { PLATFORM_CITY_OPTIONS } from '@/lib/platform-cities'

/**
 * Scroll-driven animation banner for the homepage.
 * Upload frame images in order — they play as the user scrolls.
 * Supports per-city/country targeting and scheduling.
 */
export const scrollAnimationType = defineType({
  name: 'scrollAnimation',
  title: 'Scroll Animation',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Animation Name',
      type: 'string',
      description: 'Internal name (e.g. "Firefly Burger reveal", "Summer drinks"). Shown in Studio.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'frames',
      title: 'Frame Images',
      type: 'array',
      of: [
        {
          type: 'image',
          options: { hotspot: false },
        },
      ],
      description: 'Drop all frame images at once — they are sorted by filename number and uploaded in parallel. Recommended: 20–60 frames.',
      validation: (Rule) => Rule.min(2).error('Need at least 2 frames for animation.'),
      components: {
        input: BulkImageUploadInput,
      },
    }),
    defineField({
      name: 'scrollHeight',
      title: 'Scroll Distance (vh)',
      type: 'number',
      description: 'How many viewport-heights of scrolling to complete the animation. Higher = slower, more scroll. Default: 400.',
      initialValue: 400,
      validation: (Rule) => Rule.min(100).max(1000),
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
      description:
        'Restrict by region (inferred from the customer’s selected city). Leave empty only if you use Cities below — at least one of Countries or Cities is required.',
    }),
    defineField({
      name: 'cities',
      title: 'Cities (filter)',
      type: 'array',
      of: [
        {
          type: 'string',
          options: {
            list: PLATFORM_CITY_OPTIONS,
            layout: 'dropdown',
          },
        },
      ],
      options: {
        layout: 'list',
      },
      description:
        'English city names; must match the customer’s selected city. Leave empty only if you use Countries above — at least one of Cities or Countries is required.',
      validation: (Rule) => Rule.unique(),
    }),
    defineField({
      name: 'sortOrder',
      title: 'List order (Studio)',
      type: 'number',
      initialValue: 0,
      description: 'Lower numbers sort first in Studio lists only. The live site picks randomly among matching animations.',
    }),
    defineField({
      name: 'startDate',
      title: 'Start Date & Time',
      type: 'datetime',
      description: 'When to start showing. Leave empty to show immediately.',
    }),
    defineField({
      name: 'endDate',
      title: 'End Date & Time',
      type: 'datetime',
      description: 'When to stop showing. Leave empty to show indefinitely.',
    }),
    defineField({
      name: 'enabled',
      title: 'Enabled',
      type: 'boolean',
      initialValue: true,
      description: 'Quick toggle to disable without deleting.',
    }),
  ],
  validation: (Rule) =>
    Rule.custom((doc) => {
      const d = doc as { cities?: unknown[]; countries?: unknown[] } | undefined
      if (!d) return true
      const hasCities = Array.isArray(d.cities) && d.cities.length > 0
      const hasCountries = Array.isArray(d.countries) && d.countries.length > 0
      if (!hasCities && !hasCountries) {
        return 'Set at least one city or country. Untargeted animations are not shown on the homepage.'
      }
      return true
    }),
  preview: {
    select: {
      title: 'title',
      enabled: 'enabled',
      startDate: 'startDate',
      endDate: 'endDate',
      frameCount: 'frames.length',
      media: 'frames.0',
    },
    prepare({ title, enabled, startDate, endDate, media }) {
      const status = enabled === false ? ' [OFF]' : ''
      const scheduled = startDate || endDate ? ' (scheduled)' : ''
      return {
        title: `${title ?? 'Untitled'}${status}${scheduled}`,
        media,
      }
    },
  },
  orderings: [
    { title: 'Sort order (asc)', name: 'sortOrderAsc', by: [{ field: 'sortOrder', direction: 'asc' }] },
    { title: 'Title A–Z', name: 'titleAsc', by: [{ field: 'title', direction: 'asc' }] },
  ],
})
