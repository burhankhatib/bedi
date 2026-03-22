import { getFirestoreAdmin } from '@/lib/firebase-admin'
import { RatingPrompt } from './types'
import { sendRatingPromptPush } from './push'

export async function createRatingPromptsForOrder(
  orderId: string,
  siteId: string,
  orderType: 'delivery' | 'pickup' | 'dine-in',
  customerId: string | null | undefined,
  driverId: string | null | undefined
) {
  const db = getFirestoreAdmin()
  if (!db) {
    console.error('[RatingOrchestrator] Firestore not configured, skipping rating prompts.')
    return
  }

  const nowMs = Date.now()
  const expiresAtMs = nowMs + 1000 * 60 * 60 * 24 * 7 // 7 days

  const prompts: RatingPrompt[] = []

    const makeId = (raterRole: string, raterId: string, targetRole: string, targetId: string) =>
      `${orderId}_${raterRole}_${raterId}_${targetRole}_${targetId}`

    // Optionally get rater names if we want to store them, but for privacy we don't need to.
    // The active rating creation doesn't store raterName right now.


  // Customer rates Business (Step 1)
  if (customerId) {
    prompts.push({
        id: makeId('customer', customerId, 'business', siteId),
        orderId,
        siteId,
        orderType,
        raterRole: 'customer',
        raterId: customerId,
        targetRole: 'business',
        targetId: siteId,
        status: 'pending',
        createdAtMs: nowMs,
        expiresAtMs,
        flowStep: 1,
        // Since we don't fetch customer name directly in this function, we skip raterName here
        // We'll modify ActiveRating creation to just have 'customer' -> masked behavior in UI
      })
  }

  if (orderType === 'delivery' && driverId) {
    // Customer rates Driver (Step 2)
    if (customerId) {
      prompts.push({
        id: makeId('customer', customerId, 'driver', driverId),
        orderId,
        siteId,
        orderType,
        raterRole: 'customer',
        raterId: customerId,
        targetRole: 'driver',
        targetId: driverId,
        status: 'pending',
        createdAtMs: nowMs,
        expiresAtMs,
        flowStep: 2,
      })
    }

    // Driver rates Business
    prompts.push({
      id: makeId('driver', driverId, 'business', siteId),
      orderId,
      siteId,
      orderType,
      raterRole: 'driver',
      raterId: driverId,
      targetRole: 'business',
      targetId: siteId,
      status: 'pending',
      createdAtMs: nowMs,
      expiresAtMs,
      flowStep: 1,
    })

    // Business rates Driver
    prompts.push({
      id: makeId('business', siteId, 'driver', driverId),
      orderId,
      siteId,
      orderType,
      raterRole: 'business',
      raterId: siteId,
      targetRole: 'driver',
      targetId: driverId,
      status: 'pending',
      createdAtMs: nowMs,
      expiresAtMs,
      flowStep: 1,
    })
  }

    // Write prompts to Firestore
    const promptsCollection = db.collection('ratingPrompts')
    for (const prompt of prompts) {
      await promptsCollection.doc(prompt.id).set(prompt as unknown as Record<string, unknown>, { merge: true }).catch(e => {
        console.error('[RatingOrchestrator] Failed to save prompt:', prompt.id, e)
      })
      
      const urlMap: Record<string, string> = {
        customer: '/my-orders',
        driver: '/driver/history',
        business: '/dashboard' // Let dashboard redirect to the correct slug
      }
    
    // Only send push if this is the first step in the flow
    if (prompt.flowStep === 1) {
      await sendRatingPromptPush(prompt.raterId, prompt.raterRole, urlMap[prompt.raterRole] || '/').catch(e => {
        console.error('[RatingOrchestrator] Failed to send push:', e)
      })
    }
  }
}
