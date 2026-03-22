export type RatingRole = 'customer' | 'driver' | 'business'

export type RatingPromptStatus = 'pending' | 'completed' | 'dismissed' | 'expired'

export interface RatingPrompt {
  id: string // doc id
  orderId: string
  siteId: string
  orderType: 'delivery' | 'pickup' | 'dine-in'
  
  raterRole: RatingRole
  raterId: string
  
  targetRole: RatingRole
  targetId: string

  status: RatingPromptStatus
  createdAtMs: number
  expiresAtMs: number
  completedAtMs?: number
}

export interface ActiveRating {
  id: string // compound key: `${orderId}_${raterId}_${targetId}`
  orderId: string
  siteId: string
  orderType: string
  
  raterRole: RatingRole
  raterId: string
  
  targetRole: RatingRole
  targetId: string
  
  score: number // 1 to 5
  feedback?: string
  tags?: string[]
  
  status: 'visible' | 'hidden' | 'flagged' | 'under_review'
  
  createdAtMs: number
  updatedAtMs: number
  version: number
}

export interface VersionedRating extends ActiveRating {
  activeRatingId: string // The ID of the ActiveRating this belongs to
  versionId: string // Unique ID for this version
}

export interface RatingAggregate {
  id: string // targetId (e.g., driverId, customerId, tenantId)
  targetRole: RatingRole
  siteId?: string // if scoped to a site, but generally just the targetId
  
  averageScore: number
  totalCount: number
  
  // Distribution of scores
  score1Count: number
  score2Count: number
  score3Count: number
  score4Count: number
  score5Count: number
  
  updatedAtMs: number
}
