// Querying with "sanityFetch" will keep content automatically updated
// Before using it, import and render "<SanityLive />" in your layout, see
// https://github.com/sanity-io/next-sanity#live-content-api for more information.
import { defineLive } from "next-sanity/live";
import { client } from './client'
import { token } from './token'

export const { sanityFetch, SanityLive } = defineLive({
  client: client.withConfig({ 
    // Live content is available only on the 'published' perspective
    useCdn: true,
    ...(token && { token }), // ✅ Token passed here
  }),
  serverToken: token, // ✅ Server token
  browserToken: token, // ✅ Browser token
});