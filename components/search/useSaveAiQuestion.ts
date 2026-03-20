'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useUser } from '@clerk/nextjs'
import { addGuestQuestion } from '@/lib/ai-search-questions'

/** Saves a question: to Sanity when logged in, to localStorage when guest. Fire-and-forget. */
export function useSaveAiQuestion() {
  const { isSignedIn } = useUser()
  const saveAbortRef = useRef<AbortController | null>(null)

  useEffect(() => () => saveAbortRef.current?.abort(), [])

  const saveQuestion = useCallback(
    (question: string) => {
      const q = typeof question === 'string' ? question.trim() : ''
      if (!q) return
      if (isSignedIn) {
        saveAbortRef.current?.abort()
        const ac = new AbortController()
        saveAbortRef.current = ac
        fetch('/api/me/search-questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: q }),
          credentials: 'include',
          signal: ac.signal,
        }).catch((e) => {
          if ((e as Error)?.name === 'AbortError') return
          console.warn('[AI] Save question failed:', e)
        })
      } else {
        addGuestQuestion(q)
      }
    },
    [isSignedIn]
  )

  return { saveQuestion }
}
