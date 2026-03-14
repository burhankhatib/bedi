'use client'

import { useCallback } from 'react'
import { useUser } from '@clerk/nextjs'
import { addGuestQuestion } from '@/lib/ai-search-questions'

/** Saves a question: to Sanity when logged in, to localStorage when guest. Fire-and-forget. */
export function useSaveAiQuestion() {
  const { isSignedIn } = useUser()

  const saveQuestion = useCallback(
    (question: string) => {
      const q = typeof question === 'string' ? question.trim() : ''
      if (!q) return
      if (isSignedIn) {
        fetch('/api/me/search-questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: q }),
          credentials: 'include',
        }).catch((e) => console.warn('[AI] Save question failed:', e))
      } else {
        addGuestQuestion(q)
      }
    },
    [isSignedIn]
  )

  return { saveQuestion }
}
