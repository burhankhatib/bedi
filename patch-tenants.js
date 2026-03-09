const { createClient } = require('@sanity/client');
require('dotenv').config({ path: '.env.local' });

const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET,
  apiVersion: '2024-01-01',
  token: process.env.SANITY_API_WRITE_TOKEN,
  useCdn: false,
});

async function main() {
  const tenants = await client.fetch("*[_type == 'tenant']");
  for (const tenant of tenants) {
    console.log(`Patching ${tenant.name}...`);
    await client.patch(tenant._id).set({ deliveryPricingMode: 'distance', deliveryFeeMin: 10, deliveryFeeMax: 25 }).commit();
  }
  console.log('Done!');
}
main().catch(console.error);
