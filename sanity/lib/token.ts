// Centralized token loading for both server and client contexts
export const token =
  process.env.SANITY_API_TOKEN ||
  process.env.NEXT_PUBLIC_SANITY_API_TOKEN ||
  process.env.SANITY_API ||
  undefined
