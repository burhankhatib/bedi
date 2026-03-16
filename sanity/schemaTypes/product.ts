import { defineField, defineType } from 'sanity'

export const productType = defineType({
  name: 'product',
  title: 'Product',
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
      name: 'catalogRef',
      title: 'Catalog Product (optional)',
      type: 'reference',
      to: [{ type: 'catalogProduct' }],
      description: 'When set, this product came from the catalog. Tenant can override name, image, and price.',
    }),
    defineField({
      name: 'masterCatalogRef',
      title: 'Master Catalog Product (optional)',
      type: 'reference',
      to: [{ type: 'masterCatalogProduct' }],
      description: 'When set, this product was quick-added from the master catalog.',
    }),
    defineField({
      name: 'isAvailable',
      title: 'Available',
      type: 'boolean',
      initialValue: true,
      description: 'By default all products are available. Turn off when sold out (e.g. ran out of chicken tenders). Set when it will be back.',
    }),
    defineField({
      name: 'availableAgainAt',
      title: 'Available again at',
      type: 'datetime',
      description: 'When this product will be available again. Options: 1 hour, until next opening, or custom date & time.',
      hidden: ({ parent }) => parent?.isAvailable !== false,
      options: {
        dateFormat: 'YYYY-MM-DD',
        timeFormat: 'HH:mm',
        timeStep: 1,
      },
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
      name: 'description_en',
      title: 'Description (English)',
      type: 'text',
      rows: 3,
    }),
    defineField({
      name: 'description_ar',
      title: 'Description (Arabic)',
      type: 'text',
      rows: 3,
    }),
    defineField({
      name: 'ingredients_en',
      title: 'Ingredients (English)',
      type: 'array',
      of: [{ type: 'string' }],
    }),
    defineField({
      name: 'ingredients_ar',
      title: 'Ingredients (Arabic)',
      type: 'array',
      of: [{ type: 'string' }],
    }),
    defineField({
      name: 'price',
      title: 'Price',
      type: 'number',
      validation: (Rule) => Rule.required().min(0),
      description: 'Base price. Use 0 for free items or when price is determined by variants.',
    }),
    defineField({
      name: 'hidePrice',
      title: 'Hide Price in Catalog Mode',
      type: 'boolean',
      initialValue: false,
      description: 'Hide this specific product\'s price when the menu is in catalog mode.',
    }),
    defineField({
      name: 'specialPrice',
      title: 'Special Price',
      type: 'number',
      description: 'Optional sale price',
    }),
    defineField({
      name: 'specialPriceExpires',
      title: 'Special Price Expires At',
      type: 'datetime',
      description: 'When the special price should stop being displayed',
    }),
    defineField({
      name: 'currency',
      title: 'Currency',
      type: 'string',
      initialValue: 'ILS',
    }),
    defineField({
      name: 'saleUnit',
      title: 'Sold by',
      type: 'string',
      description: 'How this item is sold (piece, per kg, per bottle, etc.)',
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
      name: 'image',
      title: 'Product Image',
      type: 'image',
      options: {
        hotspot: true,
      },
    }),
    defineField({
      name: 'tempImageUrl',
      title: 'Temporary image URL (optional)',
      type: 'url',
      description: 'Fallback temporary URL before image is uploaded to assets.',
    }),
    defineField({
      name: 'sourceUrl',
      title: 'Source URL (optional)',
      type: 'url',
      description: 'Original product page URL when imported from external source (e.g. Yummy.ps, Talabat).',
    }),
    defineField({
      name: 'additionalImages',
      title: 'Additional Images',
      type: 'array',
      of: [{ type: 'image', options: { hotspot: true } }],
      description: 'Additional images that will show on hover (second image will be used for hover effect)',
    }),
    defineField({
      name: 'category',
      title: 'Category',
      type: 'reference',
      to: [{ type: 'category' }],
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'sortOrder',
      title: 'Sort Order',
      type: 'number',
      initialValue: 0,
    }),
    defineField({
      name: 'isPopular',
      title: 'Popular Product',
      type: 'boolean',
      initialValue: false,
    }),
    defineField({
      name: 'dietaryTags',
      title: 'Dietary Tags',
      type: 'array',
      of: [{ type: 'string' }],
      options: {
        list: [
          { title: 'Vegan', value: 'vegan' },
          { title: 'Vegetarian', value: 'vegetarian' },
          { title: 'Spicy', value: 'spicy' },
          { title: 'Gluten-free', value: 'gluten-free' },
          { title: 'Contains Nuts', value: 'nuts' },
          { title: 'Halal', value: 'halal' },
        ],
      },
    }),
    defineField({
      name: 'addOns',
      title: 'Add-ons',
      type: 'array',
      of: [
        {
          type: 'object',
          name: 'addOn',
          title: 'Add-on',
          fields: [
            {
              name: 'name_en',
              title: 'Name (English)',
              type: 'string',
              validation: (Rule) => Rule.required(),
            },
            {
              name: 'name_ar',
              title: 'Name (Arabic)',
              type: 'string',
              validation: (Rule) => Rule.required(),
            },
            {
              name: 'price',
              title: 'Price',
              type: 'number',
              initialValue: 0,
              description: 'Price to add (0 for free add-on)',
            },
          ],
        },
      ],
      description: 'Optional add-ons for this product (e.g., "Chicken" +5 ILS)',
    }),
    defineField({
      name: 'variants',
      title: 'Variants',
      type: 'array',
      of: [
        {
          type: 'object',
          name: 'variantGroup',
          title: 'Variant group',
          fields: [
            {
              name: 'name_en',
              title: 'Group name (English)',
              type: 'string',
              validation: (Rule) => Rule.required(),
              description: 'e.g. Size, Color',
            },
            {
              name: 'name_ar',
              title: 'Group name (Arabic)',
              type: 'string',
              validation: (Rule) => Rule.required(),
            },
            {
              name: 'required',
              title: 'Required',
              type: 'boolean',
              initialValue: false,
              description: 'If unchecked, the customer can add the product without choosing from this group (e.g. "Make it a Meal" is optional).',
            },
            {
              name: 'options',
              title: 'Options',
              type: 'array',
              of: [
                {
                  type: 'object',
                  name: 'variantOption',
                  fields: [
                    { name: 'label_en', title: 'Label (English)', type: 'string', validation: (Rule) => Rule.required() },
                    { name: 'label_ar', title: 'Label (Arabic)', type: 'string', validation: (Rule) => Rule.required() },
                    {
                      name: 'priceModifier',
                      title: 'Price modifier',
                      type: 'number',
                      initialValue: 0,
                      description: 'Added to base price (e.g. +5 for Large). Use 0 for no change. When base price is 0, this is the option price.',
                    },
                    {
                      name: 'specialPriceModifier',
                      title: 'Special price modifier',
                      type: 'number',
                      description: 'Optional sale price for this option. When set and not expired, used instead of Price modifier.',
                    },
                    {
                      name: 'specialPriceModifierExpires',
                      title: 'Special price expires at',
                      type: 'datetime',
                      description: 'When the special price for this option should stop being used.',
                      options: {
                        dateFormat: 'YYYY-MM-DD',
                        timeFormat: 'HH:mm',
                        timeStep: 1,
                      },
                    },
                    {
                      name: 'image',
                      title: 'Option image',
                      type: 'image',
                      options: { hotspot: true },
                      description: 'Optional. When the customer selects this option, this image is shown instead of the product image (e.g. color swatch).',
                    },
                    {
                      name: 'isDefault',
                      title: 'Default option',
                      type: 'boolean',
                      initialValue: false,
                      description: 'When checked, this option is pre-selected when the customer opens the product. Only one option per group should be default.',
                    },
                  ],
                },
              ],
              validation: (Rule) => Rule.min(1),
            },
          ],
          preview: {
            select: { name_en: 'name_en', name_ar: 'name_ar' },
            prepare({ name_en, name_ar }) {
              return { title: name_en || name_ar || 'Variant' }
            },
          },
        },
      ],
      description: 'Option groups (e.g. Size, Make it a Meal). Mark "Required" only when the customer must pick one; leave unchecked for optional groups like meal upgrades.',
    }),
  ],
  preview: {
    select: {
      title_en: 'title_en',
      title_ar: 'title_ar',
      price: 'price',
      currency: 'currency',
      siteName: 'site.name',
      city: 'site.city',
      country: 'site.country',
      siteLogo: 'site.businessLogo',
    },
    prepare(selection) {
      const { title_en, title_ar, price, currency, siteName, city, country, siteLogo } = selection ?? {}
      const productName = typeof title_en === 'string' ? title_en : (typeof title_ar === 'string' ? title_ar : 'Untitled')
      const priceText = typeof price === 'number' ? `${price} ${currency || 'ILS'}` : '—'
      const business = typeof siteName === 'string' ? siteName : '—'
      const locParts = [city, country].filter(Boolean).map((s) => (typeof s === 'string' ? s : '—'))
      const location = locParts.length > 0 ? locParts.join(', ') : '—'
      const result = {
        title: productName,
        subtitle: `${business} · ${priceText} · ${location}`,
      }
      if (siteLogo) (result as { title: string; subtitle: string; media?: unknown }).media = siteLogo
      return result
    },
  },
})
