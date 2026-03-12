import { defineField, defineType } from 'sanity'

/**
 * Shared product in the catalog. Markets and greengrocers browse these and add to their menu.
 * Images can be contributed by any tenant — when a tenant uploads a new image for a catalog product,
 * it gets added here for others to use.
 */
export const catalogProductType = defineType({
  name: 'catalogProduct',
  title: 'Catalog Product',
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
      name: 'brand',
      title: 'Brand (optional)',
      type: 'string',
      description: 'e.g. Coca Cola, Tnuva, Osem',
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: { source: 'title_en', maxLength: 96 },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'category',
      title: 'Category',
      type: 'reference',
      to: [{ type: 'catalogCategory' }],
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'images',
      title: 'Images',
      type: 'array',
      of: [{ type: 'image', options: { hotspot: true } }],
      description: 'Product images. Tenants can contribute new images when adding this product to their menu.',
    }),
    defineField({
      name: 'defaultUnit',
      title: 'Default sale unit',
      type: 'string',
      description: 'How this product is typically sold. Used when tenants add from catalog.',
      options: {
        list: [
          { title: 'Piece / Each', value: 'piece' },
          { title: 'Per kg', value: 'kg' },
          { title: 'Per 100g', value: 'g' },
          { title: 'Per liter', value: 'liter' },
          { title: 'Per bottle/can', value: 'ml' },
          { title: 'Per pack', value: 'pack' },
          { title: 'Per box', value: 'box' },
          { title: 'Per bottle', value: 'bottle' },
          { title: 'Per can', value: 'can' },
          { title: 'Per bag', value: 'bag' },
          { title: 'Per dozen', value: 'dozen' },
          { title: 'Per jar', value: 'jar' },
        ],
      },
    }),
    defineField({
      name: 'description_en',
      title: 'Description (English)',
      type: 'text',
      rows: 2,
    }),
    defineField({
      name: 'description_ar',
      title: 'Description (Arabic)',
      type: 'text',
      rows: 2,
    }),
    defineField({
      name: 'sortOrder',
      title: 'Sort Order',
      type: 'number',
      initialValue: 0,
    }),
  ],
  orderings: [
    { title: 'Title', name: 'titleAsc', by: [{ field: 'title_en', direction: 'asc' }] },
  ],
  preview: {
    select: {
      title_en: 'title_en',
      title_ar: 'title_ar',
      brand: 'brand',
      categoryTitle: 'category.title_en',
    },
    prepare({ title_en, title_ar, brand, categoryTitle }) {
      const name = title_en || title_ar || 'Product'
      const parts = [name]
      if (brand) parts.push(`(${brand})`)
      if (categoryTitle) parts.push(`— ${categoryTitle}`)
      return { title: parts.join(' ') }
    },
  },
})
