import { defineField, defineType } from 'sanity'

/** Contact form submission from a suspended account (driver, business, customer). Shown on Super Admin reports dashboard. */
export const suspendedContactType = defineType({
  name: 'suspendedContact',
  title: 'Suspended account contact',
  type: 'document',
  fields: [
    defineField({
      name: 'type',
      title: 'Account type',
      type: 'string',
      options: {
        list: [
          { title: 'Business', value: 'business' },
          { title: 'Driver', value: 'driver' },
          { title: 'Customer', value: 'customer' },
        ],
      },
      validation: (Rule) => Rule.required(),
      readOnly: true,
    }),
    defineField({
      name: 'clerkUserId',
      title: 'Clerk User ID',
      type: 'string',
      description: 'Set when submitted from the app so we can resolve driver/tenant/customer for actions.',
      readOnly: true,
    }),
    defineField({
      name: 'name',
      title: 'Name',
      type: 'string',
      readOnly: true,
    }),
    defineField({
      name: 'email',
      title: 'Email',
      type: 'string',
      validation: (Rule) => Rule.required(),
      readOnly: true,
    }),
    defineField({
      name: 'message',
      title: 'Message',
      type: 'text',
      readOnly: true,
    }),
    defineField({
      name: 'createdAt',
      title: 'Submitted at',
      type: 'datetime',
      initialValue: () => new Date().toISOString(),
      readOnly: true,
    }),
    defineField({
      name: 'status',
      title: 'Status',
      type: 'string',
      options: {
        list: [
          { title: 'New', value: 'new' },
          { title: 'Read', value: 'read' },
          { title: 'Resolved', value: 'resolved' },
        ],
      },
      initialValue: 'new',
    }),
    defineField({
      name: 'archived',
      title: 'Archived',
      type: 'boolean',
      initialValue: false,
      description: 'When true, item is marked as archived and hidden from the main list.',
    }),
  ],
  preview: {
    select: { type: 'type', name: 'name', email: 'email', createdAt: 'createdAt' },
    prepare({ type, name, email, createdAt }) {
      const date = createdAt ? new Date(createdAt).toLocaleDateString() : ''
      return {
        title: `[${type ?? '?'}] ${name || email || 'Contact'}`,
        subtitle: date,
      }
    },
  },
  orderings: [
    { title: 'Newest first', name: 'createdAtDesc', by: [{ field: 'createdAt', direction: 'desc' }] },
  ],
})
