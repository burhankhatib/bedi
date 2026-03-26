import { NextResponse } from 'next/server'
import { sanityFetch } from '@/sanity/lib/fetch'

export const revalidate = 3600 // Cache for 1 hour

export async function GET() {
  try {
    const query = `*[_type == "restaurantInfo"][0].notificationSound`
    const sound = await sanityFetch<string | null>(query, {}, {
      revalidate: 3600,
      tags: ['restaurantInfo'],
    })
    return NextResponse.json({ sound: sound || '1.wav' })
  } catch (error) {
    return NextResponse.json({ sound: '1.wav' }, { status: 500 })
  }
}
