'use client'

import { useEffect, ReactNode } from 'react'
import { useAuth, useClerk } from '@clerk/nextjs'
import { useLanguage } from '@/components/LanguageContext'
import { useRouter, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'

interface AdminProtectionProps {
  children: ReactNode
  /** Reserved for future a11y / analytics (e.g. screen reader page title). */
  pageName?: string
}

export function AdminProtection({ children, pageName }: AdminProtectionProps) {
  const { t } = useLanguage()
  const { isLoaded, isSignedIn } = useAuth()
  const { signOut } = useClerk()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn) {
      const redirectUrl = pathname ? `/sign-in?redirect_url=${encodeURIComponent(pathname)}` : '/sign-in'
      router.replace(redirectUrl)
    }
  }, [isLoaded, isSignedIn, router, pathname])

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-slate-200 border-t-black rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500">{t('Loading…', 'جاري التحميل…')}</p>
        </div>
      </div>
    )
  }

  if (!isSignedIn) {
    return null
  }

  return (
    <>
      {pageName ? (
        <span className="sr-only absolute -left-[9999px] size-px overflow-hidden">
          {pageName}
        </span>
      ) : null}
      <div className="fixed top-4 right-4 z-50">
        <Button
          onClick={() => signOut({ redirectUrl: window.location.origin + '/' })}
          variant="outline"
          size="sm"
          className="rounded-xl font-bold bg-white/95 text-slate-900 backdrop-blur-sm shadow-lg hover:bg-white"
        >
          <LogOut className="w-4 h-4 mr-2" />
          {t('Sign out', 'تسجيل الخروج')}
        </Button>
      </div>
      {children}
    </>
  )
}
