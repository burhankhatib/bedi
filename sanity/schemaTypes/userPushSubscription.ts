import { defineField, defineType } from 'sanity'

/**
 * Centralized push subscriptions for all signed-in roles.
 * One document per token per role context (customer/driver/tenant).
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
        ],
      },
      validation: (Rule) => Rule.required(),
      readOnly: true,
    }),
    defineField({
      name: 'fcmToken',
      title: 'FCM Token',
      type: 'string',
      description: 'Device token used for Firebase Cloud Messaging.',
      readOnly: true,
    }),
    defineField({
      name: 'webPush',
      title: 'Web Push Subscription',
      type: 'object',
      readOnly: true,
      fields: [
        { name: 'endpoint', type: 'string', title: 'Endpoint' },
        { name: 'p256dh', type: 'string', title: 'p256dh' },
        { name: 'auth', type: 'string', title: 'auth' },
      ],
    }),
    defineField({
      name: 'deviceInfo',
      title: 'Device Info',
      type: 'string',
      description: 'Optional user agent or device identifier for debugging.',
      readOnly: true,
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
    defineField({
      name: 'lastError',
      title: 'Last Error',
      type: 'string',
      description: 'Last delivery error for this token, if any.',
      readOnly: true,
    }),
  ],
  preview: {
    select: {
      clerkUserId: 'clerkUserId',
      roleContext: 'roleContext',
      fcmToken: 'fcmToken',
      endpoint: 'webPush.endpoint',
      isActive: 'isActive',
      lastSeenAt: 'lastSeenAt',
    },
    prepare({ clerkUserId, roleContext, fcmToken, endpoint, isActive, lastSeenAt }) {
      const shortToken = fcmToken ? `${fcmToken.slice(0, 16)}…` : endpoint ? 'web-push' : 'no-token'
      const activeLabel = isActive === false ? 'inactive' : 'active'
      return {
        title: `${roleContext || 'user'} · ${shortToken}`,
        subtitle: `${clerkUserId || 'unknown'} · ${activeLabel}${lastSeenAt ? ` · ${new Date(lastSeenAt).toLocaleString()}` : ''}`,
      }
    },
  },
})
