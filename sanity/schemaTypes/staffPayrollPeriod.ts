import { defineField, defineType } from 'sanity'

export const staffPayrollPeriodType = defineType({
  name: 'staffPayrollPeriod',
  title: 'Staff Payroll Period',
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
      name: 'staff',
      title: 'Staff member',
      type: 'reference',
      to: [{ type: 'tenantStaff' }],
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'periodStart',
      title: 'Period start',
      type: 'datetime',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'periodEnd',
      title: 'Period end',
      type: 'datetime',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'regularMinutes',
      title: 'Regular minutes',
      type: 'number',
      validation: (Rule) => Rule.min(0),
    }),
    defineField({
      name: 'overtimeMinutes',
      title: 'Overtime minutes',
      type: 'number',
      validation: (Rule) => Rule.min(0),
    }),
    defineField({
      name: 'hourlyRateSnapshot',
      title: 'Hourly rate snapshot',
      type: 'number',
      validation: (Rule) => Rule.min(0),
    }),
    defineField({
      name: 'overtimeMultiplierSnapshot',
      title: 'Overtime multiplier snapshot',
      type: 'number',
      validation: (Rule) => Rule.min(1),
    }),
    defineField({
      name: 'grossPay',
      title: 'Gross pay',
      type: 'number',
      validation: (Rule) => Rule.min(0),
    }),
    defineField({
      name: 'adjustments',
      title: 'Adjustments',
      type: 'number',
      description: 'Manual positive/negative adjustments.',
      initialValue: 0,
    }),
    defineField({
      name: 'netPay',
      title: 'Net pay',
      type: 'number',
      validation: (Rule) => Rule.min(0),
    }),
    defineField({
      name: 'status',
      title: 'Status',
      type: 'string',
      options: {
        list: [
          { title: 'Draft', value: 'draft' },
          { title: 'Approved', value: 'approved' },
          { title: 'Paid', value: 'paid' },
        ],
      },
      initialValue: 'draft',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'notes',
      title: 'Notes',
      type: 'text',
      rows: 3,
      description: 'Optional payroll note for this period and staff member.',
    }),
  ],
})

