import { defineField, defineType } from 'sanity'

/**
 * Sub-category / specialty for businesses (e.g. Burgers, Shawarma, Oriental sweets).
 * Used to categorize tenants by what they offer. Manage and expand in Studio.
 * Suggested slugs for Restaurant: See docs/business-subcategories-seed.md. Includes DoorDash/Talabat-style
 * specialties: mandi, kabsa, manakeesh, kunafa, falafel, sushi, lebanese, mediterranean, vegan, etc.
 * Cafe: coffee, tea, smoothies, desserts, light-meals, breakfast.
 * Bakery: bread, pastries, cakes, oriental-sweets, savory.
 * Grocery / Supermarket / Greengrocer: supermarket, mini-market, organic, dairy, fruits-vegetables.
 * Butcher: meat, chicken, frozen.
 * Gas: gas-cylinders, camping-gas.
 * Water: water-bottles, water-gallons.
 * Retail: clothing, electronics, gifts, other.
 * Pharmacy: full, mini, other.
 */
export const businessSubcategoryType = defineType({
  name: 'businessSubcategory',
  title: 'Business Sub-category (Specialty)',
  type: 'document',
  fields: [
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      description: 'Unique ID (e.g. burgers, shawarma). Used in URLs and filters.',
      options: {
        maxLength: 64,
      },
      validation: (Rule) => Rule.required(),
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
      name: 'image',
      title: 'Image',
      type: 'image',
      options: { hotspot: true },
      description: 'Image representing this sub-category (e.g. for filters or listing).',
    }),
    defineField({
      name: 'businessType',
      title: 'Business Type (main category)',
      type: 'string',
      options: {
        list: [
          { title: 'Restaurant', value: 'restaurant' },
          { title: 'Cafe', value: 'cafe' },
          { title: 'Bakery', value: 'bakery' },
          { title: 'Grocery / Market', value: 'grocery' },
          { title: 'Supermarket', value: 'supermarket' },
          { title: 'Greengrocer (Vegetables & Fruits)', value: 'greengrocer' },
          { title: 'Butcher', value: 'butcher' },
          { title: 'Gas', value: 'gas' },
          { title: 'Water', value: 'water' },
          { title: 'Retail / Shop', value: 'retail' },
          { title: 'Pharmacy', value: 'pharmacy' },
          { title: 'Other', value: 'other' },
        ],
      },
      validation: (Rule) => Rule.required(),
      description: 'This sub-category appears when a tenant chooses this business type.',
    }),
    defineField({
      name: 'sortOrder',
      title: 'Sort Order',
      type: 'number',
      initialValue: 0,
      description: 'Lower = first when listing sub-categories.',
    }),
  ],
  preview: {
    select: {
      title_en: 'title_en',
      title_ar: 'title_ar',
      businessType: 'businessType',
      media: 'image',
    },
    prepare(selection) {
      const { title_en, title_ar, businessType, media } = selection ?? {}
      const title = title_en || title_ar || 'Sub-category'
      const typeLabel = typeof businessType === 'string'
        ? businessType.charAt(0).toUpperCase() + businessType.slice(1)
        : ''
      return {
        title,
        subtitle: typeLabel,
        media,
      }
    },
  },
  orderings: [
    { title: 'Sort Order', name: 'sortOrderAsc', by: [{ field: 'sortOrder', direction: 'asc' }] },
    { title: 'Business Type', name: 'businessTypeAsc', by: [{ field: 'businessType', direction: 'asc' }] },
  ],
})
