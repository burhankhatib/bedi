'use client'

import { useEffect, useRef } from 'react'
import { useUser } from '@clerk/nextjs'
import { getStoredGuestQuestions, clearStoredGuestQuestions } from '@/lib/ai-search-questions'

/**
 * When user signs in, sync any guest AI search questions from localStorage to Sanity.
 * Runs once per sign-in when localStorage has questions.
 */
export function AiQuestionSyncOnLogin() {
  const { isSignedIn } = useUser()
  const syncedRef = useRef(false)

  useEffect(() => {
    if (!isSignedIn || typeof window === 'undefined') return
    if (syncedRef.current) return
    const questions = getStoredGuestQuestions()
    if (questions.length === 0) return
    syncedRef.current = true
    const ac = new AbortController()
    fetch('/api/me/search-questions/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questions }),
      credentials: 'include',
      signal: ac.signal,
    })
      .then(() => {
        if (!ac.signal.aborted) clearStoredGuestQuestions()
      })
      .catch((e) => {
        if ((e as Error)?.name === 'AbortError') return
        console.warn('[AI] Sync guest questions failed:', e)
        syncedRef.current = false
      })

    return () => {
      ac.abort()
      syncedRef.current = false
    }
  }, [isSignedIn])

  return null
}
