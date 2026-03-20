'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import { useLanguage } from '@/components/LanguageContext'
import { useLocation } from '@/components/LocationContext'
import { cn } from '@/lib/utils'

export const OPEN_AI_CHAT_EVENT = 'zonify-open-ai-chat'
export const OPEN_CHAT_ON_LOAD_KEY = 'zonify-open-ai-chat-on-load'

/** Paths that have UniversalSearch in view (can open chat in-place). Others: navigate to /search. */
function hasInlineSearch(pathname: string): boolean {
  if (!pathname) return false
  if (pathname === '/') return true
  if (pathname === '/search') return true
  if (/^\/t\/[^/]+\/?$/.test(pathname)) return true
  return false
}

export function ChatFab() {
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const { city, isChosen } = useLocation()
  const { t } = useLanguage()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    if (!mounted || !city || !isChosen) {
      const id = requestAnimationFrame(() => setVisible(false))
      return () => cancelAnimationFrame(id)
    }
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [mounted, city, isChosen])

  const handleClick = () => {
    if (hasInlineSearch(pathname ?? '')) {
      window.dispatchEvent(new CustomEvent(OPEN_AI_CHAT_EVENT))
    } else {
      try {
        sessionStorage.setItem(OPEN_CHAT_ON_LOAD_KEY, '1')
      } catch { /* ignore */ }
      router.push('/search')
    }
  }

  if (!visible) return null

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={t('Open AI chat', 'فتح المحادثة')}
      className={cn(
        'fixed z-[110] flex size-12 items-center justify-center rounded-full shadow-lg',
        'bg-amber-500 text-white hover:bg-amber-600 active:scale-95 transition-all duration-200',
        'border-2 border-amber-400/50',
        'md:bottom-6 md:end-6',
        'max-md:bottom-[calc(72px+max(16px,env(safe-area-inset-bottom,0px))+12px)] max-md:end-4'
      )}
    >
      <Sparkles className="size-6" />
    </button>
  )
}
