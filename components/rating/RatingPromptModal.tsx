'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { StarInput } from './StarInput'
import { useLanguage } from '@/components/LanguageContext'

interface RatingPromptModalProps {
  open: boolean
  onClose: () => void
  promptId: string
  targetName: string
  targetRole: 'driver' | 'business' | 'customer'
  stepCount?: number
  currentStep?: number
  onSuccess?: () => void
}

export function RatingPromptModal({
  open,
  onClose,
  promptId,
  targetName,
  targetRole,
  stepCount = 1,
  currentStep = 1,
  onSuccess
}: RatingPromptModalProps) {
  const { t } = useLanguage()
  const [score, setScore] = useState(0)
  const [feedback, setFeedback] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset internal state when promptId changes
  useEffect(() => {
    if (open) {
      setScore(0)
      setFeedback('')
      setError(null)
    }
  }, [promptId, open])

  const isDark = targetRole === 'customer' || targetRole === 'driver' // e.g. business/driver dashboards are usually dark

  const handleSubmit = async () => {
    if (score === 0) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/rating/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promptId, score, feedback: feedback.trim() })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit rating')
      }
      onSuccess?.()
      if (stepCount === 1 || currentStep === stepCount) {
        onClose()
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const roleLabels = {
    driver: t('the driver', 'السائق'),
    business: t('the restaurant', 'المطعم'),
    customer: t('the customer', 'العميل'),
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent 
        className={cn(
          "sm:max-w-[400px] z-[350]", 
          isDark && "bg-slate-900 border-slate-700 text-white dark"
        )}
        overlayClassName="z-[350]"
      >
        <DialogHeader>
          <div className="flex justify-between items-center mb-2">
            <DialogTitle className="text-xl font-bold">
              {t('Rate your experience', 'قيم تجربتك')}
            </DialogTitle>
            {stepCount > 1 && (
              <span className="text-sm font-semibold text-amber-600 dark:text-amber-500 bg-amber-100 dark:bg-amber-500/10 px-2 py-0.5 rounded-full">
                {currentStep} / {stepCount}
              </span>
            )}
          </div>
          <DialogDescription className="text-left text-base text-slate-600 dark:text-slate-400">
            {t('How was your experience with', 'كيف كانت تجربتك مع')} <strong className="text-slate-900 dark:text-white">{targetName}</strong>?
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-6 py-4">
          <StarInput value={score} onChange={setScore} disabled={submitting} />

          {score > 0 && (
            <div className="w-full space-y-2 animate-in fade-in slide-in-from-bottom-2">
              <label className="text-sm font-medium px-1">
                {t('Leave feedback (optional)', 'أضف تعليق (اختياري)')}
              </label>
              <textarea
                value={feedback}
                onChange={e => setFeedback(e.target.value)}
                placeholder={t('Tell us what you liked or what could be improved...', 'أخبرنا بما أعجبك أو ما يمكن تحسينه...')}
                className={cn(
                  "w-full rounded-xl border p-3 min-h-[100px] text-sm resize-none focus:ring-2 focus:ring-amber-500 focus:outline-none",
                  isDark ? "bg-slate-800 border-slate-700 text-white placeholder-slate-400" : "bg-white border-slate-200 text-slate-900 placeholder-slate-400"
                )}
                disabled={submitting}
              />
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-500 text-center mb-2">{error}</p>}

        <div className="flex flex-col gap-2 mt-2">
          <Button
            onClick={handleSubmit}
            disabled={score === 0 || submitting}
            className={cn(
              "w-full rounded-full min-h-12 text-base font-semibold transition-transform active:scale-[0.98]",
              "bg-amber-500 text-slate-950 hover:bg-amber-400"
            )}
          >
            {submitting ? t('Submitting...', 'جاري التقييم...') : 
             stepCount > 1 && currentStep < stepCount ? t('Next', 'التالي') : 
             t('Submit Rating', 'إرسال التقييم')}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              // On skip, still consider it a success for advancing flow, but we didn't submit
              onSuccess?.()
              if (stepCount === 1 || currentStep === stepCount) {
                onClose()
              }
            }}
            disabled={submitting}
            className="w-full rounded-full min-h-12"
          >
            {stepCount > 1 ? t('Skip this step', 'تخطي هذه الخطوة') : t('Not now', 'ليس الآن')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(' ')
}
