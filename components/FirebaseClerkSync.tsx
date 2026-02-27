'use client'

/**
 * When the user is signed in with Clerk, get a custom token from the "firebase" JWT template
 * and sign in to Firebase Auth. This keeps Clerk and Firebase in sync for the customer (e.g. menu).
 * Run once when the user is loaded and signed in.
 */
import { useAuth } from '@clerk/nextjs'
import { useEffect, useRef } from 'react'

export function FirebaseClerkSync() {
  const { isSignedIn, getToken } = useAuth()
  const synced = useRef(false)

  useEffect(() => {
    if (!isSignedIn || !getToken || synced.current) return
    let cancelled = false
    synced.current = true
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
        synced.current = false
      }
    })()
    return () => { cancelled = true }
  }, [isSignedIn, getToken])

  return null
}
