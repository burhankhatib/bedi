import { defineField, defineType } from 'sanity'

export const tableServiceRequestType = defineType({
  name: 'tableServiceRequest',
  title: 'Table service request',
  type: 'document',
  description: 'Standalone "call waiter" from table QR when customer has no order yet',
  fields: [
    defineField({
      name: 'site',
      title: 'Site',
      type: 'reference',
      to: [{ type: 'tenant' }],
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'tableNumber',
      title: 'Table number',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'type',
      title: 'Request type',
      type: 'string',
      initialValue: 'call_waiter',
      options: {
        list: [{ title: 'Call waiter', value: 'call_waiter' }],
      },
      readOnly: true,
    }),
    defineField({
      name: 'createdAt',
      title: 'Created at',
      type: 'datetime',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'acknowledgedAt',
      title: 'Acknowledged at',
      type: 'datetime',
      description: 'When staff acknowledged the request (stops notification)',
    }),
  ],
  preview: {
    select: { tableNumber: 'tableNumber', createdAt: 'createdAt' },
    prepare({ tableNumber, createdAt }: { tableNumber?: string; createdAt?: string }) {
      return {
        title: `Table ${tableNumber ?? '—'} · Call waiter`,
        subtitle: createdAt ? new Date(createdAt).toLocaleString() : undefined,
      }
    },
  },
})
