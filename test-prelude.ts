import Prelude from "@prelude.so/sdk"
const client = new Prelude({ apiToken: 'test' })
client.verification.create({
  target: { type: 'phone_number', value: '+1234567890' },
  options: {
    custom_routing: { type: 'custom', channels: ['whatsapp', 'sms'] }
  } as any
})
