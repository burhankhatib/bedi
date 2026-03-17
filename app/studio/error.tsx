'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function StudioError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const msg = error?.message ?? ''
  const isAuthRelated =
    /unauthorized|forbidden|not permitted|permission denied|sign.?in|session|token|clerk|401|403|500|internal server error|application error/i.test(msg)

  useEffect(() => {
    if (isAuthRelated) {
      window.location.href = '/sign-in?redirect_url=' + encodeURIComponent('/studio')
      return
    }
    console.error('Studio error:', error)
  }, [isAuthRelated, error])

  if (isAuthRelated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <h1 className="text-xl font-bold text-slate-900 mb-2">Session expired or sign-in required</h1>
          <p className="text-slate-600">Redirecting you to sign in…</p>
          <a
            href="/sign-in?redirect_url=%2Fstudio"
            className="mt-6 inline-flex items-center justify-center rounded-lg bg-black text-white font-medium px-6 py-3 hover:bg-slate-800"
          >
            Sign in
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        <h1 className="text-2xl font-black text-slate-900 mb-4">
          Studio Error
        </h1>
        <p className="text-slate-600 mb-6">
          {error.message || 'An error occurred while loading the Studio'}
        </p>
        {error.digest && (
          <p className="text-xs text-slate-400 mb-6 font-mono">
            Error ID: {error.digest}
          </p>
        )}
        <div className="flex flex-wrap gap-3 justify-center">
          <Button onClick={reset} className="bg-black text-white hover:bg-slate-800">
            Try Again
          </Button>
          <Button
            onClick={() => (window.location.href = '/sign-in?redirect_url=' + encodeURIComponent('/studio'))}
            variant="outline"
          >
            Sign in
          </Button>
          <Button
            onClick={() => (window.location.href = '/')}
            variant="outline"
          >
            Go Home
          </Button>
        </div>
        <details className="mt-6 text-left">
          <summary className="cursor-pointer text-sm text-slate-500 hover:text-slate-700">
            Technical Details
          </summary>
          <pre className="mt-2 text-xs bg-slate-100 p-4 rounded overflow-auto max-h-48">
            {error.stack || String(error)}
          </pre>
        </details>
      </div>
    </div>
  )
}
