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
  targetName 
}: { 
  orderId?: string
  raterRole: 'customer' | 'driver' | 'business'
  raterId?: string
  targetName?: string
}) {
  const { t } = useLanguage()
  const [prompt, setPrompt] = useState<RatingPrompt | null>(null)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  const fetchPrompt = () => {
    const params = new URLSearchParams()
    if (orderId) params.append('orderId', orderId)
    params.append('raterRole', raterRole)
    if (raterId) params.append('raterId', raterId)

    fetch(`/api/rating/pending?${params.toString()}`)
      .then(r => r.json())
      .then(data => {
        setPrompt(data.prompt || null)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchPrompt()
  }, [orderId, raterRole, raterId])

  if (loading || !prompt) return null

  return (
    <div className="mt-4 flex flex-col items-center gap-3 w-full animate-in fade-in zoom-in duration-300">
      <Button 
        onClick={() => setShowModal(true)}
        className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-full min-h-12 shadow-sm active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
      >
        <Star className="w-5 h-5 fill-current" />
        {t('Rate your experience', 'قيم تجربتك')}
      </Button>

      <RatingPromptModal
        open={showModal}
        onClose={() => setShowModal(false)}
        promptId={prompt.id}
        targetName={
          targetName || 
          (prompt.targetRole === 'customer' ? t('the customer', 'العميل') : 
           prompt.targetRole === 'business' ? t('the restaurant', 'المطعم') : 
           prompt.targetRole === 'driver' ? t('the driver', 'السائق') : 
           t('them', 'هم'))
        }
        targetRole={prompt.targetRole as 'business' | 'driver' | 'customer'}
        onSuccess={() => {
          setPrompt(null)
          fetchPrompt()
        }}
      />
    </div>
  )
}
