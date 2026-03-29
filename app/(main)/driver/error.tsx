'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { LogIn, RefreshCw } from 'lucide-react'

/**
 * Driver PWA/routes error boundary. On auth errors redirect to sign-in;
 * otherwise show Try again / Sign in so drivers are not stuck.
 */
export default function DriverError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const msg = error?.message ?? ''
  const isAuthRelated = /unauthorized|forbidden|not permitted|permission denied|sign.?in|session|token|clerk|401|403/i.test(msg)

  useEffect(() => {
    if (isAuthRelated) {
      window.location.href = '/sign-in?redirect_url=/driver'
    }
  }, [isAuthRelated])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-white">
      <div className="text-center max-w-md">
        <h1 className="text-xl font-bold mb-2">
          {isAuthRelated ? 'Session expired or sign-in required' : 'Something went wrong'}
        </h1>
        <p className="text-slate-400 text-sm mb-6">
          {isAuthRelated
            ? 'Redirecting you to sign in…'
            : 'We couldn’t load the driver app. Sign in again or try again.'}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild className="bg-amber-500 text-slate-950 hover:bg-amber-400" size="lg">
            <Link href="/sign-in?redirect_url=/driver">
              <LogIn className="mr-2 size-4" />
              Sign in
            </Link>
          </Button>
          {!isAuthRelated && (
            <Button onClick={reset} variant="outline" size="lg" className="border-slate-600 text-white hover:bg-slate-800">
              <RefreshCw className="mr-2 size-4" />
              Try again
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
