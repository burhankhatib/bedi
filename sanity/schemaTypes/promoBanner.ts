import { defineField, defineType } from 'sanity'

export const promoBannerType = defineType({
  name: 'promoBanner',
  title: 'Promo Banner',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Internal Name',
      type: 'string',
      description: 'Used for identification in the Studio',
    }),
    defineField({
      name: 'image',
      title: 'Banner Image',
      type: 'image',
      options: { hotspot: true },
      description: 'The promotional image to display',
    }),
    defineField({
      name: 'linkUrl',
      title: 'Link URL (Optional)',
      type: 'string',
      description: 'Where this banner should redirect to when clicked',
    }),
    defineField({
      name: 'isActive',
      title: 'Is Active',
      type: 'boolean',
      initialValue: true,
      description: 'Toggle to show/hide this banner on the homepage',
    }),
    defineField({
      name: 'sortOrder',
      title: 'Sort Order',
      type: 'number',
      initialValue: 0,
      description: 'Lower numbers show first',
    }),
  ],
})