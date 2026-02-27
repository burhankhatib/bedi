import { defineField, defineType } from 'sanity'

/**
 * One document per Clerk user. Account type is mutually exclusive:
 * - driver: can only access Driver dashboard; PWA opens /driver with driver icon.
 * - tenant: can only access Business dashboard; PWA opens /dashboard with business icon.
 * Set when they first create a business (tenant) or join as driver (driver). Never both.
 */
export const platformUserType = defineType({
  name: 'platformUser',
  title: 'Platform User',
  type: 'document',
  fields: [
    defineField({
      name: 'clerkUserId',
      title: 'Clerk User ID',
      type: 'string',
      description: 'Clerk auth user ID. One platformUser per Clerk account.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'accountType',
      title: 'Account Type',
      type: 'string',
      options: {
        list: [
          { title: 'Driver only', value: 'driver' },
          { title: 'Business (Tenant) only', value: 'tenant' },
        ],
      },
      description: 'Mutually exclusive: driver = Driver dashboard only; tenant = Business dashboard only. Set on first create (business or driver).',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'isTenant',
      title: 'Is Tenant',
      type: 'boolean',
      initialValue: false,
      readOnly: true,
      description: 'True if this user owns at least one tenant. Kept in sync for Studio.',
    }),
    defineField({
      name: 'isDriver',
      title: 'Is Driver',
      type: 'boolean',
      initialValue: false,
      readOnly: true,
      description: 'True if this user has a driver profile. Kept in sync for Studio.',
    }),
  ],
  preview: {
    select: { clerkUserId: 'clerkUserId', accountType: 'accountType' },
    prepare({ clerkUserId, accountType }) {
      return {
        title: clerkUserId || 'Unknown',
        subtitle: accountType === 'driver' ? 'Driver' : accountType === 'tenant' ? 'Business' : '—',
      }
    },
  },
})
