import { defineField, defineType } from 'sanity'

export const areaType = defineType({
  name: 'area',
  title: 'Delivery Area',
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
      name: 'name_en',
      title: 'Area Name (English)',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'name_ar',
      title: 'Area Name (Arabic)',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'deliveryPrice',
      title: 'Delivery Price',
      type: 'number',
      validation: (Rule) => Rule.required().min(0),
      description: 'Delivery fee for this area. Set to 0 for free delivery.',
      initialValue: 0,
    }),
    defineField({
      name: 'currency',
      title: 'Currency',
      type: 'string',
      initialValue: 'ILS',
      description: 'Currency for delivery price',
    }),
    defineField({
      name: 'estimatedTime',
      title: 'Estimated Delivery Time (minutes)',
      type: 'number',
      validation: (Rule) => Rule.min(0),
      description: 'Estimated delivery time in minutes',
    }),
    defineField({
      name: 'isActive',
      title: 'Active',
      type: 'boolean',
      initialValue: true,
      description: 'Enable or disable delivery to this area',
    }),
    defineField({
      name: 'sortOrder',
      title: 'Sort Order',
      type: 'number',
      initialValue: 0,
      description: 'Order in which areas appear in the list',
    }),
  ],
  preview: {
    select: {
      name_en: 'name_en',
      name_ar: 'name_ar',
      deliveryPrice: 'deliveryPrice',
      currency: 'currency',
      isActive: 'isActive',
      tenantName: 'site.name',
      city: 'site.city',
      country: 'site.country',
      siteLogo: 'site.businessLogo',
    },
    prepare(selection) {
      const { name_en, name_ar, deliveryPrice, currency, isActive, tenantName, city, country, siteLogo } = selection ?? {}
      const areaName = typeof name_en === 'string' ? name_en : (typeof name_ar === 'string' ? name_ar : 'Area')
      const priceText = deliveryPrice === 0 ? 'Free' : `${deliveryPrice} ${currency || ''}`
      const status = isActive ? '✅' : '❌'
      const business = typeof tenantName === 'string' ? tenantName : '—'
      const locParts = [city, country].filter(Boolean).map((s) => (typeof s === 'string' ? s : '—'))
      const location = locParts.length > 0 ? locParts.join(', ') : '—'
      const result = {
        title: areaName,
        subtitle: `${business} · ${location} · ${priceText} ${status}`,
      }
      if (siteLogo) (result as { title: string; subtitle: string; media?: unknown }).media = siteLogo
      return result
    },
  },
})
