import { Redis } from '@upstash/redis'

// Check if environment variables are available, fallback to dummy to prevent build errors if missing
const url = process.env.UPSTASH_REDIS_REST_URL || ''
const token = process.env.UPSTASH_REDIS_REST_TOKEN || ''

export const redis = url && token ? new Redis({
  url,
  token,
}) : null

if (!url || !token) {
  console.warn('UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN is missing. Redis functions will fail.')
}
