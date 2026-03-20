import { defineField, defineType } from 'sanity'

/**
 * Staff member for a tenant (business). Supports role-based access, scheduling, notifications, and payroll profile.
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
          { title: 'Kitchen', value: 'kitchen' },
          { title: 'Dispatcher', value: 'dispatcher' },
          { title: 'Accountant', value: 'accountant' },
          { title: 'Manager', value: 'manager' },
          { title: 'Custom', value: 'custom' },
        ],
      },
      initialValue: 'waiter',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'status',
      title: 'Employment status',
      type: 'string',
      options: {
        list: [
          { title: 'Active', value: 'active' },
          { title: 'Suspended', value: 'suspended' },
          { title: 'Archived', value: 'archived' },
        ],
      },
      initialValue: 'active',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'phone',
      title: 'Mobile phone',
      type: 'string',
      description: 'Optional staff phone number for contact and attendance verification.',
    }),
    defineField({
      name: 'whatsappPhone',
      title: 'WhatsApp phone',
      type: 'string',
      description: 'Optional WhatsApp destination for order alerts (with country code).',
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
          { title: 'Payroll', value: 'payroll' },
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
      name: 'notificationRules',
      title: 'Notification rules',
      type: 'object',
      fields: [
        defineField({
          name: 'receiveFcm',
          title: 'Receive FCM/Web Push',
          type: 'boolean',
          initialValue: true,
        }),
        defineField({
          name: 'receiveWhatsapp',
          title: 'Receive WhatsApp alerts',
          type: 'boolean',
          initialValue: false,
        }),
        defineField({
          name: 'newOrder',
          title: 'New order alerts',
          type: 'boolean',
          initialValue: true,
        }),
        defineField({
          name: 'unacceptedOrderReminder',
          title: 'Unaccepted order reminders',
          type: 'boolean',
          initialValue: true,
        }),
      ],
    }),
    defineField({
      name: 'workSchedule',
      title: 'Working schedule',
      type: 'object',
      fields: [
        defineField({
          name: 'timezone',
          title: 'Timezone',
          type: 'string',
          initialValue: 'Asia/Jerusalem',
          description: 'IANA timezone, e.g. Asia/Jerusalem.',
        }),
        defineField({
          name: 'days',
          title: 'Days',
          type: 'array',
          of: [
            defineField({
              type: 'object',
              name: 'staffScheduleDay',
              fields: [
                defineField({
                  name: 'dayOfWeek',
                  title: 'Day of week',
                  type: 'number',
                  validation: (Rule) => Rule.required().min(0).max(6),
                  description: '0 = Sunday, 6 = Saturday',
                }),
                defineField({
                  name: 'enabled',
                  title: 'Working day',
                  type: 'boolean',
                  initialValue: true,
                }),
                defineField({
                  name: 'start',
                  title: 'Start',
                  type: 'string',
                  description: 'HH:mm',
                }),
                defineField({
                  name: 'end',
                  title: 'End',
                  type: 'string',
                  description: 'HH:mm',
                }),
              ],
            }),
          ],
        }),
      ],
    }),
    defineField({
      name: 'payrollProfile',
      title: 'Payroll profile',
      type: 'object',
      fields: [
        defineField({
          name: 'hourlyRate',
          title: 'Hourly rate',
          type: 'number',
          description: 'Base hourly wage used for payroll calculations.',
        }),
        defineField({
          name: 'overtimeMultiplier',
          title: 'Overtime multiplier',
          type: 'number',
          initialValue: 1.5,
          description: 'Multiplier for overtime hours (e.g. 1.5).',
        }),
      ],
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
      status: 'status',
      tenantName: 'site.name',
    },
    prepare({ email, displayName, role, status, tenantName }) {
      const name = (displayName && String(displayName).trim()) || email || 'Staff'
      const roleLabel =
        role === 'waiter'
          ? 'Waiter'
          : role === 'cashier'
            ? 'Cashier'
            : role === 'kitchen'
              ? 'Kitchen'
              : role === 'dispatcher'
                ? 'Dispatcher'
                : role === 'accountant'
                  ? 'Accountant'
                  : role === 'manager'
                    ? 'Manager'
                    : 'Custom'
      return {
        title: name,
        subtitle: `${roleLabel} · ${status ?? 'active'} · ${tenantName ?? 'Business'}`,
      }
    },
  },
})
