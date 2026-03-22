import { NextRequest, NextResponse } from 'next/server'
import { getFirestoreAdmin } from '@/lib/firebase-admin'

export const revalidate = 60 // Cache for 60 seconds

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const targetId = searchParams.get('targetId')

    if (!targetId) {
      return NextResponse.json({ error: 'Missing targetId' }, { status: 400 })
    }

    const db = getFirestoreAdmin()
    if (!db) return NextResponse.json({ error: 'Firestore config error' }, { status: 500 })

    const aggDoc = await db.collection('ratingAggregates').doc(targetId).get()

    if (!aggDoc.exists) {
      return NextResponse.json({ aggregate: null })
    }

    return NextResponse.json({ aggregate: aggDoc.data() })
  } catch (error) {
    console.error('[RatingAggregate]', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
