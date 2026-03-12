import { defineType } from 'sanity'

/** Tracks processed BOP payment instruction IDs for idempotency (avoid double-extending). */
export const bopProcessedPaymentType = defineType({
  name: 'bopProcessedPayment',
  title: 'BOP Processed Payment',
  type: 'document',
  readOnly: true,
  fields: [
    {
      name: 'instructionId',
      title: 'Instruction ID',
      type: 'string',
      validation: (r) => r.required(),
    },
    {
      name: 'processedAt',
      title: 'Processed At',
      type: 'datetime',
      validation: (r) => r.required(),
    },
    {
      name: 'tenantSlug',
      title: 'Tenant Slug',
      type: 'string',
    },
    {
      name: 'planId',
      title: 'Plan ID',
      type: 'string',
    },
  ],
})
