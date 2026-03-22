import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getFirestoreAdmin } from '@/lib/firebase-admin'
import { verifyRaterAccess } from '@/lib/rating/auth'
import { ActiveRating, RatingAggregate, RatingPrompt, VersionedRating } from '@/lib/rating/types'
import { publishRatingAggregateUpdated, publishRatingSubmitted } from '@/lib/rating/pusher'
import { sendRatingReceivedPush } from '@/lib/rating/push'
import { trackRatingEvent } from '@/lib/rating/telemetry'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { promptId, score, feedback } = body

    if (!promptId || typeof score !== 'number' || score < 1 || score > 5) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    const db = getFirestoreAdmin()
    if (!db) return NextResponse.json({ error: 'Firestore config error' }, { status: 500 })

    const promptRef = db.collection('ratingPrompts').doc(promptId)
    const promptDoc = await promptRef.get()

    if (!promptDoc.exists) {
      return NextResponse.json({ error: 'Prompt not found' }, { status: 404 })
    }

    const prompt = promptDoc.data() as unknown as RatingPrompt
    if (prompt.status !== 'pending') {
      return NextResponse.json({ error: 'Prompt is no longer pending' }, { status: 400 })
    }

    const hasAccess = await verifyRaterAccess(userId, prompt.raterRole, prompt.raterId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Active rating ID is compound key: orderId_raterId_targetId
    const activeRatingId = `${prompt.orderId}_${prompt.raterId}_${prompt.targetId}`
    const activeRatingRef = db.collection('ratingsActive').doc(activeRatingId)
    const aggregateRef = db.collection('ratingAggregates').doc(prompt.targetId)
    // Create a new doc reference for version history
    const versionedRef = db.collection('ratingsVersioned').doc() // auto-id

    const nowMs = Date.now()

    let newAggregateState: RatingAggregate | null = null

    await db.runTransaction(async (t) => {
      // 1. Double check prompt status
      const pDoc = await t.get(promptRef)
      if (!pDoc.exists || (pDoc.data() as unknown as RatingPrompt).status !== 'pending') {
        throw new Error('Prompt already completed')
      }

      // 2. Fetch active rating
      const activeDoc = await t.get(activeRatingRef)
      let oldScore = 0
      let activeVersion = 1
      if (activeDoc.exists) {
        const activeData = activeDoc.data() as unknown as ActiveRating
        oldScore = activeData.score
        activeVersion = activeData.version + 1
      }

      // 3. Fetch aggregate
      const aggDoc = await t.get(aggregateRef)
      const aggData = aggDoc.exists
        ? (aggDoc.data() as unknown as RatingAggregate)
        : {
            id: prompt.targetId,
            targetRole: prompt.targetRole,
            siteId: prompt.siteId,
            averageScore: 0,
            totalCount: 0,
            score1Count: 0,
            score2Count: 0,
            score3Count: 0,
            score4Count: 0,
            score5Count: 0,
            updatedAtMs: nowMs,
          }

      // 4. Compute new aggregate
      if (oldScore === 0) {
        // New rating
        aggData.totalCount += 1
        ;(aggData as any)[`score${score}Count`] += 1
      } else {
        // Updated rating
        if (oldScore !== score) {
          ;(aggData as any)[`score${oldScore}Count`] = Math.max(0, (aggData as any)[`score${oldScore}Count`] - 1)
          ;(aggData as any)[`score${score}Count`] += 1
        }
      }

      // Recompute average
      const totalSum =
        aggData.score1Count * 1 +
        aggData.score2Count * 2 +
        aggData.score3Count * 3 +
        aggData.score4Count * 4 +
        aggData.score5Count * 5
      
      aggData.averageScore = aggData.totalCount > 0 ? Number((totalSum / aggData.totalCount).toFixed(2)) : 0
      aggData.updatedAtMs = nowMs
      newAggregateState = aggData

      // 5. Build models
      const newActive: ActiveRating = {
        id: activeRatingId,
        orderId: prompt.orderId,
        siteId: prompt.siteId,
        orderType: prompt.orderType,
        raterRole: prompt.raterRole,
        raterId: prompt.raterId,
        targetRole: prompt.targetRole,
        targetId: prompt.targetId,
        score,
        feedback: feedback || '',
        status: 'visible', // Auto visible initially. Moderation can hide.
        createdAtMs: activeDoc.exists ? (activeDoc.data() as unknown as ActiveRating).createdAtMs : nowMs,
        updatedAtMs: nowMs,
        version: activeVersion,
      }

      const versioned: VersionedRating = {
        ...newActive,
        activeRatingId,
        versionId: versionedRef.id,
      }

      // 6. Write to Firestore
      t.set(promptRef, { status: 'completed', completedAtMs: nowMs }, { merge: true })
      t.set(activeRatingRef, newActive as unknown as Record<string, unknown>, { merge: true })
      t.set(versionedRef, versioned as unknown as Record<string, unknown>, { merge: true })
      t.set(aggregateRef, aggData as unknown as Record<string, unknown>, { merge: true })
    })

    // 7. Publish realtime events
    if (newAggregateState) {
      await publishRatingSubmitted(prompt.targetRole, prompt.targetId).catch(console.warn)
      await publishRatingAggregateUpdated(newAggregateState).catch(console.warn)
      await sendRatingReceivedPush(prompt.targetId, prompt.targetRole, score).catch(console.warn)
    }

    trackRatingEvent('rating_submitted', {
      raterRole: prompt.raterRole,
      targetRole: prompt.targetRole,
      score,
      hasFeedback: !!feedback
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[RatingSubmit]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
