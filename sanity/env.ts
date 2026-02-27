export const apiVersion =
  process.env.NEXT_PUBLIC_SANITY_API_VERSION || 
  process.env.SANITY_API_VERSION || 
  '2026-01-27'

export const useCdn = process.env.SANITY_API_USE_CDN !== 'false'

export const studioUrl = process.env.NEXT_PUBLIC_SANITY_STUDIO_URL || 'http://localhost:3000/studio'

// Use fallback values during build to prevent build failures
// These will be overridden at runtime if env vars are set
export const dataset =
  process.env.NEXT_PUBLIC_SANITY_DATASET || 'production'

export const projectId =
  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || ''

export const token = 
  process.env.SANITY_API_TOKEN || 
  process.env.NEXT_PUBLIC_SANITY_API_TOKEN ||
  process.env.SANITY_API

// Validation function that can be called at runtime
export function validateSanityEnv() {
  if (!process.env.NEXT_PUBLIC_SANITY_DATASET) {
    throw new Error('Missing environment variable: NEXT_PUBLIC_SANITY_DATASET')
  }
  if (!process.env.NEXT_PUBLIC_SANITY_PROJECT_ID) {
    throw new Error('Missing environment variable: NEXT_PUBLIC_SANITY_PROJECT_ID')
  }
}
