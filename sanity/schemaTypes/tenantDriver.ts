import { defineField, defineType } from 'sanity'

/**
 * Links a tenant to a driver in their fleet. Allows custom display name per tenant.
 * Tenant's "drivers" list = TenantDriver where site = tenant.
 */
export const tenantDriverType = defineType({
  name: 'tenantDriver',
  title: 'Tenant Driver (Captain in fleet)',
  type: 'document',
  fields: [
    defineField({
      name: 'site',
      title: 'Tenant',
      type: 'reference',
      to: [{ type: 'tenant' }],
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'driver',
      title: 'Driver',
      type: 'reference',
      to: [{ type: 'driver' }],
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'customName',
      title: 'Display name (optional)',
      type: 'string',
      description: 'Name to show for this driver in your business. Leave empty to use the driver’s default name.',
    }),
    defineField({
      name: 'isActive',
      title: 'Active',
      type: 'boolean',
      initialValue: true,
    }),
    defineField({
      name: 'deliveryAreas',
      title: 'Delivery areas (for this tenant)',
      type: 'array',
      of: [{ type: 'reference', to: [{ type: 'area' }] }],
      description: 'Areas this driver can deliver to for your business',
    }),
  ],
  preview: {
    select: {
      customName: 'customName',
      driverName: 'driver.name',
      driverPhone: 'driver.phoneNumber',
    },
    prepare(selection) {
      const { customName, driverName, driverPhone } = selection ?? {}
      const name = typeof customName === 'string' ? customName : (typeof driverName === 'string' ? driverName : 'Driver')
      const subtitle = typeof driverPhone === 'string' ? `Driver: ${driverPhone}` : ''
      return { title: name, subtitle }
    },
  },
})
