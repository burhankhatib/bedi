import { defineField, defineType } from 'sanity'

/**
 * Request to transfer business ownership to another user.
 * Only Super Admin can approve. After approval, tenant clerkUserId is updated and previous owner loses access.
 */
export const tenantTransferRequestType = defineType({
  name: 'tenantTransferRequest',
  title: 'Tenant Transfer Request',
  type: 'document',
  fields: [
    defineField({
      name: 'tenant',
      title: 'Business (Tenant)',
      type: 'reference',
      to: [{ type: 'tenant' }],
      validation: (Rule) => Rule.required(),
      readOnly: true,
    }),
    defineField({
      name: 'requestedByClerkId',
      title: 'Requested by (Clerk User ID)',
      type: 'string',
      description: 'Current owner who initiated the transfer',
      validation: (Rule) => Rule.required(),
      readOnly: true,
    }),
    defineField({
      name: 'requestedByEmail',
      title: 'Current owner email',
      type: 'string',
      description: 'For display in admin',
      readOnly: true,
    }),
    defineField({
      name: 'newOwnerEmail',
      title: 'New owner email',
      type: 'string',
      description: 'The new owner must already be registered on the system',
      validation: (Rule) => Rule.required(),
      readOnly: true,
    }),
    defineField({
      name: 'status',
      title: 'Status',
      type: 'string',
      options: {
        list: [
          { title: 'Pending', value: 'pending' },
          { title: 'Approved', value: 'approved' },
          { title: 'Rejected', value: 'rejected' },
        ],
      },
      initialValue: 'pending',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'createdAt',
      title: 'Requested at',
      type: 'datetime',
      initialValue: () => new Date().toISOString(),
      readOnly: true,
    }),
    defineField({
      name: 'reviewedByClerkId',
      title: 'Reviewed by (Super Admin Clerk ID)',
      type: 'string',
      readOnly: true,
    }),
    defineField({
      name: 'reviewedAt',
      title: 'Reviewed at',
      type: 'datetime',
      readOnly: true,
    }),
    defineField({
      name: 'rejectionReason',
      title: 'Rejection reason (optional)',
      type: 'string',
      description: 'Shown to the requester if rejected',
    }),
  ],
  preview: {
    select: {
      tenantName: 'tenant.name',
      newOwnerEmail: 'newOwnerEmail',
      status: 'status',
      createdAt: 'createdAt',
    },
    prepare({ tenantName, newOwnerEmail, status, createdAt }) {
      const date = createdAt ? new Date(createdAt).toLocaleDateString() : ''
      return {
        title: `${tenantName ?? 'Business'} → ${newOwnerEmail ?? '?'}`,
        subtitle: `${status ?? 'pending'} · ${date}`,
      }
    },
  },
  orderings: [
    { title: 'Pending first, then newest', name: 'pendingNewest', by: [{ field: 'status', direction: 'asc' }, { field: 'createdAt', direction: 'desc' }] },
  ],
})
