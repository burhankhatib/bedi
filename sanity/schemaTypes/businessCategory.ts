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
      description:
        'Machine id: lowercase letters, numbers, hyphens — e.g. restaurant, juice_bar. Must match tenant.businessType. Add new types in Admin → Business taxonomy.',
      validation: (Rule) =>
        Rule.required().regex(
          /^[a-z0-9][a-z0-9_-]*$/,
          'machine id: lowercase start, then letters, numbers, hyphens or underscores'
        ),
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
      description: 'Square or landscape recommended. Shown on homepage tiles when set.',
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
