import { defineField, defineType } from 'sanity'

export const platformAreaType = defineType({
  name: 'platformArea',
  title: 'Platform City (Service Area)',
  type: 'document',
  description: 'Platform-level city boundaries for geofencing. Editable in Admin Areas map.',
  fields: [
    defineField({
      name: 'name',
      title: 'City Name',
      type: 'string',
      validation: (Rule) => Rule.required(),
      description: 'City identifier used in geofencing (e.g. Bethany, Jerusalem)',
    }),
    defineField({
      name: 'coordinates',
      title: 'Polygon Coordinates',
      type: 'string',
      validation: (Rule) => Rule.required(),
      description: 'JSON array of [longitude, latitude] pairs forming the polygon ring. Closed ring (first point = last point).',
    }),
  ],
  preview: {
    select: { name: 'name' },
    prepare: ({ name }) => ({ title: name ?? 'Platform Area' }),
  },
})
