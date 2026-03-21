'use client'

/**
 * When the user is signed in with Clerk, get a custom token from the "firebase" JWT template
 * and sign in to Firebase Auth. This keeps Clerk and Firebase in sync for the customer (e.g. menu).
 * Run once per signed-in session; skips entirely if Firebase env is incomplete.
 *
 * If production shows Identity Toolkit `CONFIGURATION_NOT_FOUND`, fix Firebase Console + Vercel
 * `NEXT_PUBLIC_FIREBASE_*` (same Web app as Firebase project) and enable Authentication.
 */
import { useAuth } from '@clerk/nextjs'
import { useEffect, useRef } from 'react'
import { isFirebaseConfigured } from '@/lib/firebase-config'

export function FirebaseClerkSync() {
  const { isSignedIn, getToken } = useAuth()
  /** One attempt per sign-in session; never reset on failure (avoids retry spam + console noise). */
  const syncAttemptedForSession = useRef(false)

  useEffect(() => {
    if (!isSignedIn) {
      syncAttemptedForSession.current = false
      return
    }
    if (!getToken || !isFirebaseConfigured() || syncAttemptedForSession.current) return

    syncAttemptedForSession.current = true
    let cancelled = false

    ;(async () => {
      try {
        const token = await getToken({ template: 'firebase' })
        if (!token || cancelled) return
        const { getApp, getApps, initializeApp } = await import('firebase/app')
        const { getAuth, signInWithCustomToken } = await import('firebase/auth')
        const config = (await import('@/lib/firebase-config')).getFirebaseConfig()
        if (!config) return
        const app = getApps().length ? getApp() : initializeApp({
          apiKey: config.apiKey,
          authDomain: config.authDomain,
          projectId: config.projectId,
          storageBucket: config.storageBucket,
          messagingSenderId: config.messagingSenderId,
          appId: config.appId,
        })
        const auth = getAuth(app)
        await signInWithCustomToken(auth, token)
      } catch {
        // Wrong API key / deleted project / CONFIGURATION_NOT_FOUND — infra must be fixed; do not retry.
      }
    })()

    return () => {
      cancelled = true
    }
  }, [isSignedIn, getToken])

  return null
}
