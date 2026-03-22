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

    const limit = parseInt(searchParams.get('limit') || '20', 10)

    const reviewsSnap = await (db.collection('ratingsActive')
      .where('targetId', '==', targetId) as any)
      .where('status', '==', 'visible')
      .orderBy('updatedAtMs', 'desc')
      .limit(limit)
      .get()

    const reviews = reviewsSnap.docs.map((doc: any) => {
      const data = doc.data()
      // Mask the raterId/name if it's a customer.
      // We don't have the name in the doc directly, but we can pass a special flag or 
      // rely on the component to show the default "A***" if we don't have the real name.
      return {
        id: data.id,
        score: data.score,
        feedback: data.feedback,
        raterRole: data.raterRole,
        updatedAtMs: data.updatedAtMs,
        orderType: data.orderType,
        raterId: data.raterRole === 'customer' ? 'masked' : data.raterId,
        raterName: data.raterName // Optional: we might not store it yet, but UI supports it
      }
    })

    return NextResponse.json({ reviews })
  } catch (error) {
    console.error('[RatingReviews]', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
