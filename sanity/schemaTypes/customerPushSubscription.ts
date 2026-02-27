import { defineField, defineType } from 'sanity'

/**
 * Stores FCM tokens for the Customer PWA so super admin and businesses can send
 * push notifications (order tracking, announcements, ads). One document per device token.
 */
export const customerPushSubscriptionType = defineType({
  name: 'customerPushSubscription',
  title: 'Customer Push Subscription',
  type: 'document',
  __experimental_omnisearch_visibility: false,
  fields: [
    defineField({
      name: 'fcmToken',
      title: 'FCM Token',
      type: 'string',
      description: 'Firebase Cloud Messaging token for this device.',
      validation: (Rule) => Rule.required(),
      readOnly: true,
    }),
    defineField({
      name: 'createdAt',
      title: 'Created At',
      type: 'datetime',
      description: 'When this subscription was first recorded.',
      initialValue: () => new Date().toISOString(),
      readOnly: true,
    }),
  ],
  preview: {
    select: { fcmToken: 'fcmToken', createdAt: 'createdAt' },
    prepare({ fcmToken, createdAt }) {
      const short = fcmToken ? `${fcmToken.slice(0, 20)}…` : '—'
      return {
        title: short,
        subtitle: createdAt ? new Date(createdAt).toLocaleString() : '',
      }
    },
  },
})
