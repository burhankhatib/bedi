'use client'

import { useState, useEffect } from 'react'
import { RatingPromptModal } from './RatingPromptModal'
import { RatingPrompt } from '@/lib/rating/types'
import { useLanguage } from '@/components/LanguageContext'
import { Button } from '@/components/ui/button'
import { Star } from 'lucide-react'

export function OrderRatingPrompt({ 
  orderId, 
  raterRole, 
  raterId, 
  businessDisplayName,
  driverDisplayName,
  targetName // fallback for non-customer roles or simple single prompts
}: { 
  orderId?: string
  raterRole: 'customer' | 'driver' | 'business'
  raterId?: string
  businessDisplayName?: string
  driverDisplayName?: string
  targetName?: string
}) {
  const { t } = useLanguage()
  const [prompt, setPrompt] = useState<RatingPrompt | null>(null)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [prompts, setPrompts] = useState<RatingPrompt[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)

  const currentPrompt = prompts[currentIndex]

  const fetchPrompt = () => {
    const params = new URLSearchParams()
    if (orderId) params.append('orderId', orderId)
    params.append('raterRole', raterRole)
    if (raterId) params.append('raterId', raterId)
    
    // Instead of limit=1, we can fetch all pending and handle them locally, 
    // but the API was fetching 1. Let's update the API to fetch all pending for the order,
    // or just rely on the API to return an array of prompts.
    fetch(`/api/rating/pending?${params.toString()}`)
      .then(r => r.json())
      .then(data => {
        // If API returns an array, use it. If it returns single prompt, wrap it.
        const list = data.prompts || (data.prompt ? [data.prompt] : [])
        setPrompts(list)
        setCurrentIndex(0)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchPrompt()
  }, [orderId, raterRole, raterId])

  if (loading || prompts.length === 0 || !currentPrompt) return null

  return (
    <div className="mt-4 flex flex-col items-center gap-3 w-full animate-in fade-in zoom-in duration-300">
      <Button 
        onClick={() => setShowModal(true)}
        className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-full min-h-12 shadow-sm active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
      >
        <Star className="w-5 h-5 fill-current" />
        {prompts.length > 1 
          ? t('Rate your experience (2 steps)', 'قيم تجربتك (خطوتين)')
          : t('Rate your experience', 'قيم تجربتك')}
      </Button>

      <RatingPromptModal
        open={showModal}
        onClose={() => setShowModal(false)}
        promptId={currentPrompt.id}
        targetName={
          (currentPrompt.targetRole === 'business' && businessDisplayName) ? businessDisplayName :
          (currentPrompt.targetRole === 'driver' && driverDisplayName) ? driverDisplayName :
          targetName || 
          (currentPrompt.targetRole === 'customer' ? t('the customer', 'العميل') : 
           currentPrompt.targetRole === 'business' ? t('the restaurant', 'المطعم') : 
           currentPrompt.targetRole === 'driver' ? t('the driver', 'السائق') : 
           t('them', 'هم'))
        }
        targetRole={currentPrompt.targetRole as 'business' | 'driver' | 'customer'}
        stepCount={prompts.length}
        currentStep={currentIndex + 1}
        onSuccess={() => {
          if (currentIndex < prompts.length - 1) {
            setCurrentIndex(prev => prev + 1)
          } else {
            setShowModal(false)
            setPrompts([])
            fetchPrompt()
          }
        }}
      />
    </div>
  )
}
