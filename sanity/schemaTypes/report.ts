import { defineField, defineType } from 'sanity'

/** Predefined categories per reporter/reported type for consistent reporting. */
const REPORT_CATEGORIES = [
  // Business reporting driver
  { title: 'Driver was late', value: 'driver_late', reporter: 'business', reported: 'driver' },
  { title: 'Driver not well behaved', value: 'driver_bad_conduct', reporter: 'business', reported: 'driver' },
  { title: 'Driver cancelled order without reason', value: 'driver_cancelled_no_reason', reporter: 'business', reported: 'driver' },
  { title: 'Driver did not show up', value: 'driver_no_show', reporter: 'business', reported: 'driver' },
  { title: 'Other (driver)', value: 'driver_other', reporter: 'business', reported: 'driver' },
  // Business reporting customer
  { title: 'Customer not cooperative', value: 'customer_not_nice', reporter: 'business', reported: 'customer' },
  { title: 'Customer cancelled after order was prepared', value: 'customer_cancelled_after_prep', reporter: 'business', reported: 'customer' },
  { title: 'Customer no-show / did not pick up', value: 'customer_no_show', reporter: 'business', reported: 'customer' },
  { title: 'Other (customer)', value: 'customer_other', reporter: 'business', reported: 'customer' },
  // Driver reporting customer
  { title: 'Customer late to receive order', value: 'customer_late_receive', reporter: 'driver', reported: 'customer' },
  { title: 'Customer bad behaviour', value: 'customer_bad_conduct', reporter: 'driver', reported: 'customer' },
  { title: 'Customer not at location', value: 'customer_not_at_location', reporter: 'driver', reported: 'customer' },
  { title: 'Other (customer)', value: 'customer_other_driver', reporter: 'driver', reported: 'customer' },
  // Customer reporting restaurant
  { title: 'Food quality / cold or wrong', value: 'restaurant_food_quality', reporter: 'customer', reported: 'business' },
  { title: 'Bad packaging', value: 'restaurant_bad_packaging', reporter: 'customer', reported: 'business' },
  { title: 'Missing items', value: 'restaurant_missing_items', reporter: 'customer', reported: 'business' },
  { title: 'Very late preparation', value: 'restaurant_late_prep', reporter: 'customer', reported: 'business' },
  { title: 'Other (restaurant)', value: 'restaurant_other', reporter: 'customer', reported: 'business' },
  // Customer reporting driver
  { title: 'Driver was late', value: 'driver_late_customer', reporter: 'customer', reported: 'driver' },
  { title: 'Driver rude / bad behaviour', value: 'driver_rude', reporter: 'customer', reported: 'driver' },
  { title: 'Driver did not deliver properly', value: 'driver_delivery_issue', reporter: 'customer', reported: 'driver' },
  { title: 'Other (driver)', value: 'driver_other_customer', reporter: 'customer', reported: 'driver' },
] as const

export const reportType = defineType({
  name: 'report',
  title: 'Report',
  type: 'document',
  fields: [
    defineField({
      name: 'reporterType',
      title: 'Reporter type',
      type: 'string',
      options: {
        list: [
          { title: 'Business', value: 'business' },
          { title: 'Driver', value: 'driver' },
          { title: 'Customer', value: 'customer' },
        ],
      },
      validation: (Rule) => Rule.required(),
      readOnly: true,
    }),
    defineField({
      name: 'reportedType',
      title: 'Reported type',
      type: 'string',
      options: {
        list: [
          { title: 'Business / Restaurant', value: 'business' },
          { title: 'Driver', value: 'driver' },
          { title: 'Customer', value: 'customer' },
        ],
      },
      validation: (Rule) => Rule.required(),
      readOnly: true,
    }),
    defineField({
      name: 'order',
      title: 'Order',
      type: 'reference',
      to: [{ type: 'order' }],
      description: 'Order related to this report',
      readOnly: true,
    }),
    defineField({
      name: 'category',
      title: 'Category',
      type: 'string',
      description: 'Predefined reason category',
      options: {
        list: REPORT_CATEGORIES.map((c) => ({ title: c.title, value: c.value })),
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'text',
      rows: 4,
      description: 'Additional details',
    }),
    defineField({
      name: 'reporterTenantId',
      title: 'Reporter tenant ID',
      type: 'string',
      description: 'When reporter is business: tenant _id',
      readOnly: true,
      hidden: ({ parent }) => parent?.reporterType !== 'business',
    }),
    defineField({
      name: 'reporterDriverId',
      title: 'Reporter driver ID',
      type: 'string',
      description: 'When reporter is driver: driver _id',
      readOnly: true,
      hidden: ({ parent }) => parent?.reporterType !== 'driver',
    }),
    defineField({
      name: 'reportedTenantId',
      title: 'Reported tenant ID',
      type: 'string',
      readOnly: true,
      hidden: ({ parent }) => parent?.reportedType !== 'business',
    }),
    defineField({
      name: 'reportedDriverId',
      title: 'Reported driver ID',
      type: 'string',
      readOnly: true,
      hidden: ({ parent }) => parent?.reportedType !== 'driver',
    }),
    defineField({
      name: 'reportedCustomerInfo',
      title: 'Reported customer info',
      type: 'string',
      description: 'Customer name/phone when reported',
      readOnly: true,
      hidden: ({ parent }) => parent?.reportedType !== 'customer',
    }),
    defineField({
      name: 'status',
      title: 'Status',
      type: 'string',
      options: {
        list: [
          { title: 'New', value: 'new' },
          { title: 'Read', value: 'read' },
          { title: 'Reviewed', value: 'reviewed' },
          { title: 'Resolved', value: 'resolved' },
        ],
      },
      initialValue: 'new',
    }),
    defineField({
      name: 'archived',
      title: 'Archived (read / hidden)',
      type: 'boolean',
      initialValue: false,
      description: 'When true, report is marked as read and can be hidden from the main list.',
    }),
  ],
  preview: {
    select: {
      reporterType: 'reporterType',
      reportedType: 'reportedType',
      category: 'category',
      orderNumber: 'order.orderNumber',
    },
    prepare({ reporterType, reportedType, category, orderNumber }) {
      return {
        title: `${reporterType} → ${reportedType}: ${category || '—'}`,
        subtitle: orderNumber ? `Order #${orderNumber}` : undefined,
      }
    },
  },
})
