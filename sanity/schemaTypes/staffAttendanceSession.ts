import { defineField, defineType } from 'sanity'

export const staffAttendanceSessionType = defineType({
  name: 'staffAttendanceSession',
  title: 'Staff Attendance Session',
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
      description: 'Present for tenant staff users. Owner sessions may not include this.',
    }),
    defineField({
      name: 'actorEmail',
      title: 'Actor email',
      type: 'string',
      description: 'Email used for sign-in during this session.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'actorRole',
      title: 'Actor role at clock-in',
      type: 'string',
      description: 'Snapshot of role at clock-in time (owner/waiter/cashier/etc).',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'status',
      title: 'Session status',
      type: 'string',
      options: {
        list: [
          { title: 'Open', value: 'open' },
          { title: 'Closed', value: 'closed' },
        ],
      },
      initialValue: 'open',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'clockInAt',
      title: 'Clock-in at',
      type: 'datetime',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'clockInLat',
      title: 'Clock-in latitude',
      type: 'number',
    }),
    defineField({
      name: 'clockInLng',
      title: 'Clock-in longitude',
      type: 'number',
    }),
    defineField({
      name: 'clockInDistanceMeters',
      title: 'Clock-in distance from business (m)',
      type: 'number',
    }),
    defineField({
      name: 'clockOutAt',
      title: 'Clock-out at',
      type: 'datetime',
    }),
    defineField({
      name: 'clockOutLat',
      title: 'Clock-out latitude',
      type: 'number',
    }),
    defineField({
      name: 'clockOutLng',
      title: 'Clock-out longitude',
      type: 'number',
    }),
    defineField({
      name: 'clockOutDistanceMeters',
      title: 'Clock-out distance from business (m)',
      type: 'number',
    }),
    defineField({
      name: 'clockOutMethod',
      title: 'Clock-out method',
      type: 'string',
      options: {
        list: [
          { title: 'Manual', value: 'manual' },
          { title: 'Auto (left geofence)', value: 'auto_geofence_exit' },
          { title: 'Manager force', value: 'manager_force' },
        ],
      },
    }),
    defineField({
      name: 'clockOutReason',
      title: 'Clock-out reason',
      type: 'string',
      description: 'Optional reason for manual/manager clock-out.',
    }),
    defineField({
      name: 'closedBy',
      title: 'Closed by',
      type: 'reference',
      to: [{ type: 'tenantStaff' }],
      description: 'Manager/staff who closed this session when available.',
    }),
    defineField({
      name: 'closedByEmail',
      title: 'Closed by email',
      type: 'string',
      description: 'Email of user who closed the session.',
    }),
    defineField({
      name: 'totalMinutes',
      title: 'Total worked minutes',
      type: 'number',
      description: 'Calculated at clock-out.',
      readOnly: true,
    }),
  ],
  preview: {
    select: {
      actorEmail: 'actorEmail',
      role: 'actorRole',
      status: 'status',
      clockInAt: 'clockInAt',
      totalMinutes: 'totalMinutes',
      tenantName: 'site.name',
    },
    prepare({ actorEmail, role, status, clockInAt, totalMinutes, tenantName }) {
      const time = clockInAt ? new Date(clockInAt).toLocaleString() : '—'
      const mins = typeof totalMinutes === 'number' ? `${totalMinutes} min` : 'open'
      return {
        title: `${actorEmail || 'Staff'} (${role || '—'})`,
        subtitle: `${tenantName || 'Business'} · ${status || '—'} · ${mins} · ${time}`,
      }
    },
  },
})

