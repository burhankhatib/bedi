'use client'

import { useEffect } from 'react'

/**
 * Catches errors that escape the root layout (e.g. font loading, ClientProviders).
 * Redirects to sign-in instead of showing Internal Server Error / Application error.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const msg = error?.message ?? ''
  const shouldRedirect =
    /unauthorized|forbidden|not permitted|permission denied|sign.?in|session|token|clerk|401|403|500|internal server error|application error/i.test(msg)

  useEffect(() => {
    if (shouldRedirect && typeof window !== 'undefined') {
      const path = window.location.pathname || '/'
      const allowed =
        path.startsWith('/') &&
        !path.startsWith('//') &&
        (path === '/' ||
          path.startsWith('/dashboard') ||
          path.startsWith('/driver') ||
          path.startsWith('/onboarding') ||
          path.startsWith('/admin') ||
          path.startsWith('/studio') ||
          path.startsWith('/t/') ||
          path.startsWith('/join') ||
          path.startsWith('/resolve') ||
          path.startsWith('/verify-phone') ||
          path.startsWith('/sign-in') ||
          path.startsWith('/orders'))
      const returnTo = allowed ? path : '/'
      window.location.href = `/sign-in?redirect_url=${encodeURIComponent(returnTo)}`
    }
  }, [shouldRedirect])

  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col items-center justify-center bg-slate-950 px-4 text-white font-sans">
        <div className="text-center max-w-md">
          <h1 className="text-xl font-bold mb-2">
            {shouldRedirect ? 'Session expired or sign-in required' : 'Something went wrong'}
          </h1>
          <p className="text-slate-400 text-sm mb-6">
            {shouldRedirect
              ? 'Redirecting you to sign in…'
              : 'An unexpected error occurred. Please sign in again or try from the homepage.'}
          </p>
          {shouldRedirect ? (
            <a
              href="/sign-in?redirect_url=/"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500 text-slate-950 font-medium px-6 py-3 hover:bg-amber-400"
            >
              Sign in
            </a>
          ) : (
            <div className="flex flex-wrap justify-center gap-3">
              <button
                onClick={() => reset()}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500 text-slate-950 font-medium px-6 py-3 hover:bg-amber-400"
              >
                Try again
              </button>
              <a
                href="/sign-in?redirect_url=/"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-600 bg-slate-800/80 text-white font-medium px-6 py-3 hover:bg-slate-700"
              >
                Sign in
              </a>
              <a
                href="/"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-600 bg-slate-800/80 text-white font-medium px-6 py-3 hover:bg-slate-700"
              >
                Home
              </a>
            </div>
          )}
        </div>
      </body>
    </html>
  )
}
