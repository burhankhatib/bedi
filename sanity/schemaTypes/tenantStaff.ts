import { defineField, defineType } from 'sanity'

/**
 * Staff member for a tenant (business). Waiter, Cashier, Manager, or custom role.
 * Staff sign in with Clerk (same email as stored here) and get access based on role/permissions.
 * Each staff has their own FCM/Web Push tokens for order notifications.
 */
export const tenantStaffType = defineType({
  name: 'tenantStaff',
  title: 'Staff member',
  type: 'document',
  fields: [
    defineField({
      name: 'site',
      title: 'Business',
      type: 'reference',
      to: [{ type: 'tenant' }],
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'email',
      title: 'Email',
      type: 'string',
      description: 'Staff sign-in email (must match their Clerk account). Stored lowercase.',
      validation: (Rule) => Rule.required().email(),
    }),
    defineField({
      name: 'displayName',
      title: 'Display name',
      type: 'string',
      description: 'Optional name shown in the staff list (e.g. "Ahmad", "Sarah").',
    }),
    defineField({
      name: 'role',
      title: 'Role',
      type: 'string',
      options: {
        list: [
          { title: 'Waiter', value: 'waiter' },
          { title: 'Cashier', value: 'cashier' },
          { title: 'Manager', value: 'manager' },
          { title: 'Custom', value: 'custom' },
        ],
      },
      initialValue: 'waiter',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'permissions',
      title: 'Permission overrides',
      type: 'array',
      of: [{ type: 'string' }],
      options: {
        list: [
          { title: 'Orders (view & edit)', value: 'orders' },
          { title: 'Order history', value: 'history' },
          { title: 'Manage staff', value: 'staff_manage' },
          { title: 'Billing', value: 'billing' },
          { title: 'Business profile', value: 'settings_business' },
          { title: 'Menu', value: 'settings_menu' },
          { title: 'Tables', value: 'settings_tables' },
          { title: 'Drivers', value: 'settings_drivers' },
          { title: 'Analytics', value: 'analytics' },
          { title: 'Transfer ownership', value: 'transfer' },
        ],
      },
      description: 'Leave empty to use role defaults. For Custom role, set explicitly. Owner can override any role.',
      hidden: ({ document }) => document?.role !== 'custom',
    }),
    defineField({
      name: 'fcmTokens',
      title: 'FCM tokens',
      type: 'array',
      of: [{ type: 'string' }],
      description: 'Push notification tokens for this staff member (mobile).',
      readOnly: true,
      hidden: true,
    }),
    defineField({
      name: 'pushSubscription',
      title: 'Web Push subscription',
      type: 'object',
      fields: [
        { name: 'endpoint', type: 'string', title: 'Endpoint' },
        { name: 'p256dh', type: 'string', title: 'p256dh key' },
        { name: 'auth', type: 'string', title: 'Auth key' },
      ],
      description: 'Web Push for desktop. Set when staff enables notifications on orders page.',
      readOnly: true,
      hidden: true,
    }),
    defineField({
      name: 'createdAt',
      title: 'Added at',
      type: 'datetime',
      initialValue: () => new Date().toISOString(),
      readOnly: true,
    }),
  ],
  preview: {
    select: {
      email: 'email',
      displayName: 'displayName',
      role: 'role',
      tenantName: 'site.name',
    },
    prepare({ email, displayName, role, tenantName }) {
      const name = (displayName && String(displayName).trim()) || email || 'Staff'
      const roleLabel = role === 'waiter' ? 'Waiter' : role === 'cashier' ? 'Cashier' : role === 'manager' ? 'Manager' : 'Custom'
      return {
        title: name,
        subtitle: `${roleLabel} · ${tenantName ?? 'Business'}`,
      }
    },
  },
})
