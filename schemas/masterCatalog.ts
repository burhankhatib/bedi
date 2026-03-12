import { defineField, defineType } from 'sanity'

/**
 * Master catalog product template used for quick-add by businesses.
 * Category uses the existing business type list so admins can segment templates.
 */
export const masterCatalogProductType = defineType({
  name: 'masterCatalogProduct',
  title: 'Master Catalog Product',
  type: 'document',
  fields: [
    defineField({
      name: 'nameEn',
      title: 'Name (English)',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'nameAr',
      title: 'Name (Arabic)',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'category',
      title: 'Category',
      type: 'string',
      options: {
        list: [
          { title: 'Restaurant', value: 'restaurant' },
          { title: 'Cafe', value: 'cafe' },
          { title: 'Bakery', value: 'bakery' },
          { title: 'Grocery / Market', value: 'grocery' },
          { title: 'Retail / Shop', value: 'retail' },
          { title: 'Pharmacy', value: 'pharmacy' },
          { title: 'Other', value: 'other' },
        ],
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'searchQuery',
      title: 'Image Search Query',
      description: 'English term used to fetch image from Unsplash (e.g. "carton of eggs").',
      type: 'string',
      validation: (Rule) => Rule.required().min(2),
    }),
    defineField({
      name: 'unitType',
      title: 'Unit Type',
      type: 'string',
      options: {
        list: [
          { title: 'kg', value: 'kg' },
          { title: 'piece', value: 'piece' },
          { title: 'pack', value: 'pack' },
        ],
      },
      initialValue: 'piece',
      validation: (Rule) => Rule.required(),
    }),
  ],
  orderings: [
    { title: 'Name (A-Z)', name: 'nameAsc', by: [{ field: 'nameEn', direction: 'asc' }] },
  ],
  preview: {
    select: {
      title: 'nameEn',
      subtitleAr: 'nameAr',
      category: 'category',
      unitType: 'unitType',
    },
    prepare({ title, subtitleAr, category, unitType }) {
      return {
        title: title || subtitleAr || 'Master item',
        subtitle: [subtitleAr, category, unitType].filter(Boolean).join(' · '),
      }
    },
  },
})

