import { defineField, defineType } from 'sanity'

export const tenantTableType = defineType({
  name: 'tenantTable',
  title: 'Dine-in Table',
  type: 'document',
  fields: [
    defineField({
      name: 'site',
      title: 'Site',
      type: 'reference',
      to: [{ type: 'tenant' }],
      description: 'Which business this table belongs to',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'tableNumber',
      title: 'Table number',
      type: 'string',
      description: 'Table identifier shown to customers (e.g. 1, 2, A1)',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'sortOrder',
      title: 'Sort order',
      type: 'number',
      initialValue: 0,
      description: 'Order in list and for display',
    }),
  ],
  preview: {
    select: {
      tableNumber: 'tableNumber',
      tenantName: 'site.name',
    },
    prepare({ tableNumber, tenantName }: { tableNumber?: string; tenantName?: string }) {
      return {
        title: `Table ${tableNumber ?? '—'}`,
        subtitle: typeof tenantName === 'string' ? tenantName : undefined,
      }
    },
  },
})
