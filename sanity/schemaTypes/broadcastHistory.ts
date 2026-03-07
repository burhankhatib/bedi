import { defineField, defineType } from 'sanity'

export const broadcastHistoryType = defineType({
  name: 'broadcastHistory',
  title: 'Broadcast History',
  type: 'document',
  fields: [
    defineField({
      name: 'message',
      title: 'Message Content',
      type: 'text',
      description: 'The message that was sent (template parameter {{2}})',
    }),
    defineField({
      name: 'targets',
      title: 'Target Audiences',
      type: 'array',
      of: [{ type: 'string' }],
    }),
    defineField({
      name: 'countries',
      title: 'Country Filters',
      type: 'string',
    }),
    defineField({
      name: 'cities',
      title: 'City Filters',
      type: 'string',
    }),
    defineField({
      name: 'specificNumbers',
      title: 'Specific Numbers',
      type: 'text',
    }),
    defineField({
      name: 'sentCount',
      title: 'Sent Count',
      type: 'number',
    }),
    defineField({
      name: 'failedCount',
      title: 'Failed Count',
      type: 'number',
    }),
    defineField({
      name: 'successfulNumbers',
      title: 'Successful Numbers',
      type: 'array',
      of: [{ type: 'string' }],
    }),
    defineField({
      name: 'failedNumbers',
      title: 'Failed Numbers',
      type: 'array',
      of: [{ type: 'string' }],
    }),
    defineField({
      name: 'totalFound',
      title: 'Total Recipients Found',
      type: 'number',
    }),
    defineField({
      name: 'errors',
      title: 'Errors',
      type: 'text',
      description: 'Details about failed messages',
    }),
    defineField({
      name: 'createdAt',
      title: 'Created At',
      type: 'datetime',
      initialValue: () => new Date().toISOString(),
    }),
  ],
  preview: {
    select: {
      message: 'message',
      sentCount: 'sentCount',
      failedCount: 'failedCount',
      createdAt: 'createdAt',
    },
    prepare(selection) {
      const { message, sentCount, failedCount, createdAt } = selection
      const date = typeof createdAt === 'string' ? new Date(createdAt).toLocaleDateString() : ''
      return {
        title: message ? message.substring(0, 50) + (message.length > 50 ? '...' : '') : 'Broadcast',
        subtitle: `Sent: ${sentCount || 0} | Failed: ${failedCount || 0} | ${date}`,
      }
    },
  },
  orderings: [
    {
      title: 'Newest First',
      name: 'createdAtDesc',
      by: [{ field: 'createdAt', direction: 'desc' }],
    },
  ],
})
