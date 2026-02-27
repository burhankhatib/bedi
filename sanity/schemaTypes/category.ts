import { defineField, defineType } from 'sanity'

export const categoryType = defineType({
  name: 'category',
  title: 'Category',
  type: 'document',
  fields: [
    defineField({
      name: 'site',
      title: 'Site',
      type: 'reference',
      to: [{ type: 'tenant' }],
      description: 'Which business/site this belongs to',
    }),
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
      options: {
        source: 'title_en',
        maxLength: 96,
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'image',
      title: 'Icon/Image',
      type: 'image',
      options: {
        hotspot: true,
      },
    }),
    defineField({
      name: 'sortOrder',
      title: 'Sort Order',
      type: 'number',
    }),
    defineField({
      name: 'subcategoryRef',
      title: 'Sub-category (for search)',
      type: 'reference',
      to: [{ type: 'businessSubcategory' }],
      description: 'Optional. Links this menu section to a business sub-category for better search and discovery. Set when picking from suggestions.',
    }),
  ],
  preview: {
    select: {
      title_en: 'title_en',
      title_ar: 'title_ar',
      siteName: 'site.name',
      image: 'image',
    },
    prepare(selection) {
      const { title_en, title_ar, siteName, image } = selection ?? {}
      const title = typeof title_en === 'string' ? title_en : (typeof title_ar === 'string' ? title_ar : 'Category')
      const business = typeof siteName === 'string' ? siteName : '—'
      const result = {
        title,
        subtitle: business,
      }
      if (image) (result as { title: string; subtitle: string; media?: unknown }).media = image
      return result
    },
  },
})
