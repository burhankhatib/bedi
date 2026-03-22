import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getTenantWithRestaurant } from '@/lib/tenant'
import { getFirestoreAdmin } from '@/lib/firebase-admin'
import ReviewsClient from './ReviewsClient'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const tenant = await getTenantWithRestaurant(slug)
  if (!tenant) return { title: 'Not found' }

  const restaurantInfo = tenant.restaurantInfo
  const name = restaurantInfo?.name_en || restaurantInfo?.name_ar || tenant.name || 'Reviews'
  
  return {
    title: `${name} - Reviews`,
  }
}

export default async function TenantReviewsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const tenant = await getTenantWithRestaurant(slug)
  if (!tenant) notFound()

  const db = getFirestoreAdmin()
  if (!db) {
    return <div>Firestore not configured</div>
  }

  const targetId = tenant._id

  const [aggDoc, reviewsSnap] = await Promise.all([
    db.collection('ratingAggregates').doc(targetId).get(),
    (db.collection('ratingsActive')
      .where('targetId', '==', targetId) as any)
      .where('status', '==', 'visible')
      .orderBy('updatedAtMs', 'desc')
      .limit(50)
      .get()
  ])

  const aggregate = aggDoc.exists ? aggDoc.data() : null

  const reviews = reviewsSnap.docs.map((doc: any) => {
    const data = doc.data()
    return {
      id: data.id,
      score: data.score,
      feedback: data.feedback,
      raterRole: data.raterRole,
      updatedAtMs: data.updatedAtMs,
      orderType: data.orderType,
      raterId: data.raterRole === 'customer' ? 'masked' : data.raterId,
      raterName: data.raterName // Optional
    }
  })

  return (
    <ReviewsClient 
      tenant={tenant} 
      aggregate={aggregate as any} 
      initialReviews={reviews as any} 
    />
  )
}
