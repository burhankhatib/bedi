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
      description: 'Leave empty to show everywhere. Otherwise, only when user country matches.',
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
        'Pick one or more cities from the list (English name is stored; must match the customer’s selected city). Leave empty to show in all cities.',
      validation: (Rule) => Rule.unique(),
    }),
    defineField({
      name: 'priority',
      title: 'Display priority',
      type: 'number',
      initialValue: 5,
      description:
        '1 = lowest, 10 = highest. When several animations match the visitor, higher priority appears first (stacked top to bottom on the homepage). Leave unset to use default 5 for older entries.',
      validation: (Rule) => Rule.integer().min(1).max(10),
    }),
    defineField({
      name: 'sortOrder',
      title: 'Tiebreaker order',
      type: 'number',
      initialValue: 0,
      description:
        'When two animations have the same priority, lower numbers appear first.',
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
  preview: {
    select: {
      title: 'title',
      priority: 'priority',
      enabled: 'enabled',
      startDate: 'startDate',
      endDate: 'endDate',
      frameCount: 'frames.length',
      media: 'frames.0',
    },
    prepare({ title, priority, enabled, startDate, endDate, media }) {
      const status = enabled === false ? ' [OFF]' : ''
      const scheduled = startDate || endDate ? ' (scheduled)' : ''
      const pr = typeof priority === 'number' ? ` · P${priority}` : ''
      return {
        title: `${title ?? 'Untitled'}${pr}${status}${scheduled}`,
        media,
      }
    },
  },
  orderings: [
    {
      title: 'Priority (high first)',
      name: 'priorityDesc',
      by: [
        { field: 'priority', direction: 'desc' },
        { field: 'sortOrder', direction: 'asc' },
      ],
    },
    { title: 'Sort order (asc)', name: 'sortOrderAsc', by: [{ field: 'sortOrder', direction: 'asc' }] },
  ],
})
