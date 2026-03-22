import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function sendTestMessage(lang) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const version = 'v21.0';

  const payload = {
    messaging_product: 'whatsapp',
    to: '972546708508',
    type: 'template',
    template: {
      name: 'new_order',
      language: {
        code: lang,
      },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: 'Test Business' },
            { type: 'text', text: 'Test Order Summary' }
          ]
        },
        {
          type: 'button',
          sub_type: 'url',
          index: '0',
          parameters: [
            { type: 'text', text: 'orders' }
          ]
        }
      ]
    }
  };

  const url = `https://graph.facebook.com/${version}/${phoneNumberId}/messages`;
  
  console.log(`Sending to ${url} with lang ${lang}...`);
  
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const err = await res.json();
    console.error(`Failed (${lang}):`, JSON.stringify(err, null, 2));
    return false;
  } else {
    const data = await res.json();
    console.log(`Success (${lang}):`, data);
    return true;
  }
}

async function run() {
  const successAr = await sendTestMessage('ar');
  if (!successAr) {
    await sendTestMessage('ar_EG');
  }
}

run().catch(console.error);