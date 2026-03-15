/**
 * Seed platformArea documents from CITY_POLYGONS.
 * Run: npx tsx scripts/seed-platform-areas.ts
 */
import path from 'path'
import { config } from 'dotenv'
import { createClient } from '@sanity/client'
import { CITY_POLYGONS } from '../lib/geofencing'

config({ path: path.join(process.cwd(), '.env.local') })

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production'
const token = process.env.SANITY_API_TOKEN ?? process.env.SANITY_API_WRITE_TOKEN ?? process.env.SANITY_API

if (!projectId || !dataset) {
  console.error('Missing NEXT_PUBLIC_SANITY_PROJECT_ID or NEXT_PUBLIC_SANITY_DATASET')
  process.exit(1)
}

if (!token) {
  console.error('Missing SANITY_API_TOKEN (or SANITY_API_WRITE_TOKEN) for writes')
  process.exit(1)
}

const client = createClient({
  projectId,
  dataset,
  apiVersion: '2026-01-27',
  token,
  useCdn: false,
})

async function main() {
  const existing = await client.fetch<{ name: string }[]>(
    `*[_type == "platformArea"]{ name }`
  )
  const existingNames = new Set((existing ?? []).map((d) => d.name))

  let created = 0
  let updated = 0

  for (const city of CITY_POLYGONS) {
    const coords = [...city.coordinates]
    if (coords.length >= 3) {
      const first = coords[0]
      const last = coords[coords.length - 1]
      if (first[0] !== last?.[0] || first[1] !== last?.[1]) {
        coords.push(first)
      }
    }
    const coordsJson = JSON.stringify(coords)

    if (existingNames.has(city.name)) {
      const doc = await client.fetch<{ _id: string } | null>(
        `*[_type == "platformArea" && name == $name][0]{ _id }`,
        { name: city.name }
      )
      if (doc) {
        await client.patch(doc._id).set({ coordinates: coordsJson }).commit()
        updated++
      }
    } else {
      await client.create({
        _type: 'platformArea',
        name: city.name,
        coordinates: coordsJson,
      })
      created++
    }
  }

  console.log(`Platform areas: ${created} created, ${updated} updated.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
