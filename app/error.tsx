'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { RefreshCw, Home, LogIn } from 'lucide-react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const msg = error.message || 'An unexpected error occurred'
  const isAuthRelated =
    /unauthorized|forbidden|sign.?in|session|token|clerk|401|403|500|internal server error/i.test(msg)

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 text-white">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-bold mb-2">
          {isAuthRelated ? 'Session expired or sign-in required' : 'Something went wrong'}
        </h1>
        <p className="text-slate-400 text-sm mb-6">
          {isAuthRelated
            ? 'Please sign in again to continue.'
            : msg}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          {isAuthRelated ? (
            <Button asChild className="bg-amber-500 text-slate-950 hover:bg-amber-400" size="lg">
              <Link href="/sign-in?redirect_url=/">
                <LogIn className="mr-2 size-4" />
                Sign in
              </Link>
            </Button>
          ) : (
            <Button
              onClick={reset}
              className="bg-amber-500 text-slate-950 hover:bg-amber-400"
              size="lg"
            >
              <RefreshCw className="mr-2 size-4" />
              Try again
            </Button>
          )}
          {!isAuthRelated && (
            <Button asChild variant="outline" size="lg" className="border-slate-600 bg-slate-800/80 text-white hover:bg-slate-700">
              <Link href="/sign-in?redirect_url=/">
                <LogIn className="mr-2 size-4" />
                Sign in
              </Link>
            </Button>
          )}
          <Button asChild variant="outline" size="lg" className="border-slate-600 bg-slate-800/80 text-white hover:bg-slate-700">
            <Link href="/">
              <Home className="mr-2 size-4" />
              Home
            </Link>
          </Button>
        </div>
        <p className="text-slate-500 text-xs mt-12 px-4">
          If you opened this from your home screen and it isn't working, try opening the site in your regular browser first.
        </p>
      </div>
    </div>
  )
}
