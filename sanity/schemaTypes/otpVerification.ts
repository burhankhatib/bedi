import { defineField, defineType } from 'sanity'

export const otpVerificationType = defineType({
  name: 'otpVerification',
  title: 'OTP Verification',
  type: 'document',
  fields: [
    defineField({
      name: 'phoneNumber',
      title: 'Phone Number',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'code',
      title: 'Verification Code',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'expiresAt',
      title: 'Expires At',
      type: 'datetime',
      validation: (rule) => rule.required(),
    }),
  ],
  preview: {
    select: {
      title: 'phoneNumber',
      subtitle: 'code',
    },
  },
})
