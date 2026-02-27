import { defineField, defineType } from 'sanity'

/** Singleton: Super Admin settings for homepage hero banners. */
export const bannerSettingsType = defineType({
  name: 'bannerSettings',
  title: 'Banner Settings',
  type: 'document',
  fields: [
    defineField({
      name: 'imageDurationSeconds',
      title: 'Image banner duration (seconds)',
      type: 'number',
      description: 'How long each image banner is shown before auto-advancing to the next. Video banners advance when the video ends. Default: 10.',
      initialValue: 10,
      validation: (Rule) => Rule.min(3).max(120),
    }),
  ],
  preview: {
    prepare() {
      return { title: 'Banner Settings' }
    },
  },
})
