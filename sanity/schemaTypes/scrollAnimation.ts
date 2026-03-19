import { defineField, defineType } from 'sanity'
import { BulkImageUploadInput } from '../components/BulkImageUploadInput'

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
      of: [{ type: 'string' }],
      description: 'Leave empty to show in all cities. Otherwise, only when user city matches.',
    }),
    defineField({
      name: 'sortOrder',
      title: 'Sort Order',
      type: 'number',
      initialValue: 0,
      description: 'Lower = shown first if multiple animations match. Only the top-matching animation is displayed.',
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
    { title: 'Sort Order (asc)', name: 'sortOrderAsc', by: [{ field: 'sortOrder', direction: 'asc' }] },
  ],
})
