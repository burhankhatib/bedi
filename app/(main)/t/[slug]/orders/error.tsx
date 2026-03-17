'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { LogIn, RefreshCw, LayoutDashboard } from 'lucide-react'

export default function TenantOrdersError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const params = useParams()
  const slug = params?.slug as string | undefined

  const msg = error?.message ?? ''
  const isAuthRelated = /unauthorized|forbidden|not permitted|permission denied|sign.?in|session|token|clerk|401|403|500|internal server error|application error/i.test(msg)

  useEffect(() => {
    if (isAuthRelated) {
      window.location.href = `/sign-in?redirect_url=${slug ? `/t/${slug}/orders` : '/dashboard'}`
      return
    }
  }, [isAuthRelated, slug])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center bg-slate-950 px-4 text-white">
        <div className="text-center max-w-md">
          <h1 className="text-xl font-bold mb-2">
            {isAuthRelated ? 'Session expired or sign-in required' : 'Something went wrong'}
          </h1>
          <p className="text-slate-400 text-sm mb-6">
            {isAuthRelated
              ? 'Redirecting you to sign in…'
              : 'We couldn’t load the orders. Sign in again or try again.'}
          </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild className="bg-amber-500 text-slate-950 hover:bg-amber-400" size="lg">
            <Link href={`/sign-in?redirect_url=${slug ? `/t/${slug}/orders` : '/dashboard'}`}>
              <LogIn className="mr-2 size-4" />
              Sign in
            </Link>
          </Button>
          {!isAuthRelated && (
            <>
              <Button onClick={reset} variant="outline" size="lg" className="border-slate-600 text-white hover:bg-slate-800">
                <RefreshCw className="mr-2 size-4" />
                Try again
              </Button>
              <Button asChild variant="ghost" size="lg" className="text-slate-300 hover:text-white">
                <Link href="/dashboard">
                  <LayoutDashboard className="mr-2 size-4" />
                  Dashboard
                </Link>
              </Button>
            </>
          )}
        </div>
        <p className="text-slate-500 text-xs mt-12 px-4">
          If you opened this from your home screen and it isn't working, try opening the site in your regular browser first.
        </p>
      </div>
    </div>
  )
}
