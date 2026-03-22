import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'
import { getFirestoreAdmin } from '@/lib/firebase-admin'
import { verifyRaterAccess } from '@/lib/rating/auth'
import { RatingPrompt } from '@/lib/rating/types'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const orderId = searchParams.get('orderId')
    const raterRole = searchParams.get('raterRole')
    let raterId = searchParams.get('raterId')

    if (!raterRole) {
      return NextResponse.json({ error: 'Missing raterRole' }, { status: 400 })
    }

    if (!raterId) {
      // Derive raterId from userId
      if (raterRole === 'customer') {
        const customer = await client.fetch<{ _id: string } | null>(
          `*[_type == "customer" && clerkUserId == $userId][0]{ _id }`,
          { userId }
        )
        if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
        raterId = customer._id
      } else if (raterRole === 'driver') {
        const driver = await client.fetch<{ _id: string } | null>(
          `*[_type == "driver" && clerkUserId == $userId][0]{ _id }`,
          { userId }
        )
        if (!driver) return NextResponse.json({ error: 'Driver not found' }, { status: 404 })
        raterId = driver._id
      } else {
        return NextResponse.json({ error: 'raterId required for business role' }, { status: 400 })
      }
    } else {
      const hasAccess = await verifyRaterAccess(userId, raterRole, raterId)
      if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!orderId) {
      // If no orderId is provided, we can fetch ANY pending prompt for this user
      const db = getFirestoreAdmin()
      if (!db) return NextResponse.json({ error: 'Firestore config error' }, { status: 500 })

      const promptsSnapshot = await (db.collection('ratingPrompts')
        .where('raterId', '==', raterId) as any)
        .where('status', '==', 'pending')
        .orderBy('flowStep', 'asc')
        .get()

      if (promptsSnapshot.empty) {
        return NextResponse.json({ prompts: [] })
      }

      // We only return prompts for the FIRST order we find, so they can rate that order's things together
      const firstOrderId = (promptsSnapshot.docs[0].data() as unknown as RatingPrompt).orderId
      const relatedPrompts = promptsSnapshot.docs
        .map((d: any) => d.data() as unknown as RatingPrompt)
        .filter((p: any) => p.orderId === firstOrderId)

      return NextResponse.json({ prompts: relatedPrompts })
    }

    const db = getFirestoreAdmin()
    if (!db) return NextResponse.json({ error: 'Firestore config error' }, { status: 500 })

    const promptsSnapshot = await (db.collection('ratingPrompts')
      .where('orderId', '==', orderId) as any)
      .where('raterId', '==', raterId)
      .where('status', '==', 'pending')
      .orderBy('flowStep', 'asc')
      .get()

    if (promptsSnapshot.empty) {
      return NextResponse.json({ prompts: [] })
    }

    return NextResponse.json({ prompts: promptsSnapshot.docs.map((d: any) => d.data() as unknown as RatingPrompt) })
  } catch (error) {
    console.error('[RatingPending]', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
