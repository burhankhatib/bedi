import { defineField, defineType } from 'sanity'

export const whatsappMessageType = defineType({
  name: 'whatsappMessage',
  title: 'WhatsApp Message',
  type: 'document',
  fields: [
    defineField({
      name: 'participantPhone',
      title: 'Participant Phone',
      type: 'string',
      description: 'WhatsApp ID (phone number without +) of the sender/recipient',
    }),
    defineField({
      name: 'direction',
      title: 'Direction',
      type: 'string',
      options: { list: ['in', 'out'] },
      description: 'in = received from user, out = sent by business',
    }),
    defineField({
      name: 'text',
      title: 'Text',
      type: 'text',
      description: 'Message body (for text type)',
    }),
    defineField({
      name: 'waMessageId',
      title: 'WhatsApp Message ID',
      type: 'string',
      description: 'Meta message ID for deduplication',
    }),
    defineField({
      name: 'messageType',
      title: 'Message Type',
      type: 'string',
      options: { list: ['text', 'image', 'audio', 'video', 'document', 'unsupported'] },
      initialValue: 'text',
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
      participantPhone: 'participantPhone',
      direction: 'direction',
      text: 'text',
      createdAt: 'createdAt',
    },
    prepare(selection) {
      const { participantPhone, direction, text, createdAt } = selection
      const short = typeof text === 'string' ? text.substring(0, 40) + (text.length > 40 ? '...' : '') : ''
      return {
        title: `${direction === 'in' ? '←' : '→'} ${participantPhone}`,
        subtitle: `${short} • ${createdAt ? new Date(createdAt).toLocaleString() : ''}`,
      }
    },
  },
  orderings: [
    { title: 'Newest First', name: 'createdAtDesc', by: [{ field: 'createdAt', direction: 'desc' }] },
  ],
})
