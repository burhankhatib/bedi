/**
 * Token for Sanity mutations (API routes, scripts).
 * Intentionally excludes NEXT_PUBLIC_* env vars — those are often read-only or bundled for the client.
 */
export const writeToken =
  process.env.SANITY_API_TOKEN ||
  process.env.SANITY_API_WRITE_TOKEN ||
  process.env.SANITY_API ||
  undefined
