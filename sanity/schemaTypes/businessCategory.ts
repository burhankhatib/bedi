import { defineField, defineType } from 'sanity'

/** Homepage category tiles (Restaurants, Cafes, etc.). Admin adds image. Value matches tenant.businessType. */
export const businessCategoryType = defineType({
  name: 'businessCategory',
  title: 'Business Category',
  type: 'document',
  fields: [
    defineField({
      name: 'value',
      title: 'Value (matches tenant businessType)',
      type: 'string',
      options: {
        list: [
          { title: 'Restaurant', value: 'restaurant' },
          { title: 'Cafe', value: 'cafe' },
          { title: 'Bakery', value: 'bakery' },
          { title: 'Grocery / Market', value: 'grocery' },
          { title: 'Supermarket', value: 'supermarket' },
          { title: 'Greengrocer', value: 'greengrocer' },
          { title: 'Retail / Shop', value: 'retail' },
          { title: 'Pharmacy', value: 'pharmacy' },
          { title: 'Other', value: 'other' },
        ],
      },
      validation: (Rule) => Rule.required(),
      description: 'Must match the businessType tenants choose. Category only shows when businesses exist.',
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
      name: 'image',
      title: 'Category Image',
      type: 'image',
      options: { hotspot: true },
      validation: (Rule) => Rule.required(),
      description: 'Square or landscape recommended. Shown on homepage category grid.',
    }),
    defineField({
      name: 'sortOrder',
      title: 'Sort Order',
      type: 'number',
      initialValue: 0,
      description: 'Lower = first in grid.',
    }),
  ],
  preview: {
    select: { name_en: 'name_en', name_ar: 'name_ar', value: 'value', media: 'image' },
    prepare(selection) {
      const { name_en, name_ar, value, media } = selection ?? {}
      return {
        title: `${name_en ?? name_ar ?? value ?? 'Category'}`,
        subtitle: value,
        media,
      }
    },
  },
  orderings: [
    { title: 'Sort Order (asc)', name: 'sortOrderAsc', by: [{ field: 'sortOrder', direction: 'asc' }] },
  ],
})
