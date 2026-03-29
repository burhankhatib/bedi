import { defineField, defineType } from 'sanity'

/**
 * Centralized push subscriptions for all signed-in roles.
 * One document per user per role context (customer/driver/tenant).
 * Contains an array of active device tokens.
 */
export const userPushSubscriptionType = defineType({
  name: 'userPushSubscription',
  title: 'User Push Subscription',
  type: 'document',
  __experimental_omnisearch_visibility: false,
  fields: [
    defineField({
      name: 'clerkUserId',
      title: 'Clerk User ID',
      type: 'string',
      validation: (Rule) => Rule.required(),
      readOnly: true,
    }),
    defineField({
      name: 'roleContext',
      title: 'Role Context',
      type: 'string',
      options: {
        list: [
          { title: 'Customer', value: 'customer' },
          { title: 'Driver', value: 'driver' },
          { title: 'Tenant', value: 'tenant' },
          { title: 'Admin', value: 'admin' },
        ],
      },
      validation: (Rule) => Rule.required(),
      readOnly: true,
    }),
    defineField({
      name: 'sites',
      title: 'Tenants (Sites)',
      type: 'array',
      of: [{ type: 'reference', to: [{ type: 'tenant' }] }],
      description: 'The tenants this user is subscribed to (for Tenant role).',
      readOnly: true,
    }),
    defineField({
      name: 'devices',
      title: 'Devices',
      type: 'array',
      readOnly: true,
      of: [
        {
          type: 'object',
          fields: [
            { name: 'fcmToken', type: 'string', title: 'FCM Token' },
            {
              name: 'pushClient',
              title: 'Push Client',
              type: 'string',
              options: { list: ['native', 'pwa', 'browser'] },
            },
            {
              name: 'webPush',
              title: 'Web Push Subscription',
              type: 'object',
              fields: [
                { name: 'endpoint', type: 'string', title: 'Endpoint' },
                { name: 'p256dh', type: 'string', title: 'p256dh' },
                { name: 'auth', type: 'string', title: 'auth' },
              ],
            },
            { name: 'deviceInfo', type: 'string', title: 'Device Info' },
            { name: 'lastRefreshedAt', type: 'datetime', title: 'Last Refreshed At' },
            { name: 'lastError', type: 'string', title: 'Last Error' },
          ],
          preview: {
            select: {
              fcmToken: 'fcmToken',
              endpoint: 'webPush.endpoint',
              lastRefreshedAt: 'lastRefreshedAt',
            },
            prepare({ fcmToken, endpoint, lastRefreshedAt }) {
              const shortToken = fcmToken ? `${fcmToken.slice(0, 16)}…` : endpoint ? 'web-push' : 'no-token'
              return {
                title: shortToken,
                subtitle: lastRefreshedAt ? `Refreshed: ${new Date(lastRefreshedAt).toLocaleString()}` : '',
              }
            },
          },
        },
      ],
    }),
    defineField({
      name: 'isActive',
      title: 'Is Active',
      type: 'boolean',
      initialValue: true,
      validation: (Rule) => Rule.required(),
      readOnly: true,
    }),
    defineField({
      name: 'createdAt',
      title: 'Created At',
      type: 'datetime',
      initialValue: () => new Date().toISOString(),
      readOnly: true,
    }),
    defineField({
      name: 'lastSeenAt',
      title: 'Last Seen At',
      type: 'datetime',
      initialValue: () => new Date().toISOString(),
      readOnly: true,
    }),
  ],
  preview: {
    select: {
      clerkUserId: 'clerkUserId',
      roleContext: 'roleContext',
      devices: 'devices',
      isActive: 'isActive',
      lastSeenAt: 'lastSeenAt',
    },
    prepare({ clerkUserId, roleContext, devices, isActive, lastSeenAt }) {
      const activeLabel = isActive === false ? 'inactive' : 'active'
      const numDevices = devices?.length || 0
      return {
        title: `${roleContext || 'user'} · ${numDevices} device(s)`,
        subtitle: `${clerkUserId || 'unknown'} · ${activeLabel}${lastSeenAt ? ` · ${new Date(lastSeenAt).toLocaleString()}` : ''}`,
      }
    },
  },
})
