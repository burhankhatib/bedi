const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf-8').split('\n').reduce((acc, line) => {
  const [key, val] = line.split('=');
  if (key && val) acc[key] = val.trim();
  return acc;
}, {});

const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID;
const accessToken = env.WHATSAPP_ACCESS_TOKEN;

async function test(type) {
  let components = [];
  if (type === 'auth') {
    components = [
      {
        type: 'body',
        parameters: [{ type: 'text', text: '123456' }]
      },
      {
        type: 'button',
        sub_type: 'url',
        index: '0',
        parameters: [{ type: 'text', text: '123456' }]
      }
    ];
  } else if (type === 'text_only') {
    components = [
      {
        type: 'body',
        parameters: [{ type: 'text', text: '123456' }]
      }
    ];
  }

  const payload = {
    messaging_product: 'whatsapp',
    to: '972546708508',
    type: 'template',
    template: {
      name: 'bedi_otp',
      language: { code: 'ar' },
      components
    }
  };

  const res = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  console.log(`Type ${type}:`, res.status, JSON.stringify(data, null, 2));
}

async function run() {
  await test('auth');
  await test('text_only');
}
run();
