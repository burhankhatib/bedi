import { createClient } from 'next-sanity'

import { apiVersion, dataset, projectId } from '../env'

// Ensure we have valid configuration
if (!projectId || !dataset) {
  console.warn('Sanity client: Missing projectId or dataset. Some features may not work.');
}

export const client = createClient({
  projectId: projectId || 'missing',
  dataset: dataset || 'production',
  apiVersion,
  useCdn: true, // CDN for general reads; use clientNoCdn for fresh data (e.g. menu prices)
  requestTagPrefix: 'bedi-dev', // Sanity Usage dashboard: filter by bedi-dev.store-page, etc.
})

/** Bypasses Sanity CDN — fetches directly from API for fresh data. Use for menu/product pages. */
export const clientNoCdn = createClient({
  projectId: projectId || 'missing',
  dataset: dataset || 'production',
  apiVersion,
  useCdn: false,
  requestTagPrefix: 'bedi-dev',
})
