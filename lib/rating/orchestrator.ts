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

  // Helper to create prompt ID
  const makeId = (raterRole: string, raterId: string, targetRole: string, targetId: string) =>
    `${orderId}_${raterRole}_${raterId}_${targetRole}_${targetId}`

  // Customer rates Business
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
    })
  }

  if (orderType === 'delivery' && driverId) {
    // Customer rates Driver
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
      })
    }

    // Driver rates Customer
    if (customerId) {
      prompts.push({
        id: makeId('driver', driverId, 'customer', customerId),
        orderId,
        siteId,
        orderType,
        raterRole: 'driver',
        raterId: driverId,
        targetRole: 'customer',
        targetId: customerId,
        status: 'pending',
        createdAtMs: nowMs,
        expiresAtMs,
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
    })
  }

  // Business rates Customer
  if (customerId) {
    prompts.push({
      id: makeId('business', siteId, 'customer', customerId),
      orderId,
      siteId,
      orderType,
      raterRole: 'business',
      raterId: siteId,
      targetRole: 'customer',
      targetId: customerId,
      status: 'pending',
      createdAtMs: nowMs,
      expiresAtMs,
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
      business: `/t/${siteId}/manage/history`
    }
    await sendRatingPromptPush(prompt.raterId, prompt.raterRole, urlMap[prompt.raterRole] || '/').catch(e => {
      console.error('[RatingOrchestrator] Failed to send push:', e)
    })
  }
}
