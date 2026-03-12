import { defineField, defineType } from 'sanity'

/**
 * Shared catalog categories for grocery products (Fruits, Dairy, Beverages, etc.).
 * Used for the product catalog that markets/greengrocers browse when adding products.
 */
export const catalogCategoryType = defineType({
  name: 'catalogCategory',
  title: 'Catalog Category',
  type: 'document',
  fields: [
    defineField({
      name: 'title_en',
      title: 'Title (English)',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'title_ar',
      title: 'Title (Arabic)',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: { source: 'title_en', maxLength: 64 },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'sortOrder',
      title: 'Sort Order',
      type: 'number',
      initialValue: 0,
    }),
  ],
  orderings: [
    { title: 'Sort Order', name: 'sortOrderAsc', by: [{ field: 'sortOrder', direction: 'asc' }] },
  ],
  preview: {
    select: { title_en: 'title_en', title_ar: 'title_ar' },
    prepare({ title_en, title_ar }) {
      return { title: title_en || title_ar || 'Category' }
    },
  },
})
