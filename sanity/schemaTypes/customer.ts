import { defineField, defineType } from 'sanity'

/**
 * Customer = registered user (Clerk) who has placed at least one order.
 * Synced when orders are created so we can see all customers across all businesses.
 */
export const customerType = defineType({
  name: 'customer',
  title: 'Customer',
  type: 'document',
  fields: [
    defineField({
      name: 'clerkUserId',
      title: 'Clerk User ID',
      type: 'string',
      description: 'Clerk user ID; links to the registered account.',
      validation: (Rule) => Rule.required(),
      readOnly: true,
    }),
    defineField({
      name: 'name',
      title: 'Display Name',
      type: 'string',
      description: 'Name used on orders (from Clerk or first order).',
    }),
    defineField({
      name: 'email',
      title: 'Email',
      type: 'string',
      description: 'From Clerk account.',
      readOnly: true,
    }),
    defineField({
      name: 'primaryPhone',
      title: 'Primary Phone',
      type: 'string',
      description: 'Verified phone used for orders (E.164 or normalized).',
    }),
    defineField({
      name: 'firstOrderAt',
      title: 'First Order At',
      type: 'datetime',
      description: 'When they placed their first order.',
      readOnly: true,
    }),
    defineField({
      name: 'lastOrderAt',
      title: 'Last Order At',
      type: 'datetime',
      description: 'When they placed their most recent order.',
      readOnly: true,
    }),
    defineField({
      name: 'orderCount',
      title: 'Order Count',
      type: 'number',
      description: 'Total number of orders across all businesses.',
      initialValue: 0,
      readOnly: true,
    }),
    defineField({
      name: 'blockedBySuperAdmin',
      title: 'Blocked by Super Admin',
      type: 'boolean',
      initialValue: false,
      description: 'Super admin only: when true, this customer cannot place orders. They cannot override this.',
    }),
  ],
  preview: {
    select: {
      name: 'name',
      primaryPhone: 'primaryPhone',
      email: 'email',
      orderCount: 'orderCount',
    },
    prepare({ name, primaryPhone, email, orderCount }) {
      const title = name?.trim() || email || primaryPhone || 'Unknown'
      const subtitle = [primaryPhone, orderCount != null ? `${orderCount} orders` : ''].filter(Boolean).join(' · ')
      return { title, subtitle }
    },
  },
  orderings: [
    { title: 'Last order (newest)', name: 'lastOrderAtDesc', by: [{ field: 'lastOrderAt', direction: 'desc' }] },
    { title: 'Last order (oldest)', name: 'lastOrderAtAsc', by: [{ field: 'lastOrderAt', direction: 'asc' }] },
    { title: 'Name A–Z', name: 'nameAsc', by: [{ field: 'name', direction: 'asc' }] },
    { title: 'Order count (high first)', name: 'orderCountDesc', by: [{ field: 'orderCount', direction: 'desc' }] },
  ],
})
