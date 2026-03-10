'use client'

import { useState, useEffect } from 'react'
import { Share2, Link as LinkIcon, CheckCircle2 } from 'lucide-react'
import { useLanguage } from '@/components/LanguageContext'

export function DriverInviteInMenu() {
  const { t } = useLanguage()
  const [referralCode, setReferralCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch('/api/driver/profile')
      .then((res) => res.json())
      .then((data) => {
        if (data?.referralCode) {
          setReferralCode(data.referralCode)
        }
      })
      .catch((e) => console.error(e))
  }, [])

  const handleShare = async () => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://bedi.delivery'
    let inviteUrl = `${baseUrl}/driver/join`
    if (referralCode) {
      inviteUrl += `?ref=${referralCode}`
    }

    const shareText = t(
      'Join me as a delivery driver! 🚗',
      'انضم إلي كسائق توصيل! 🚗'
    )

    if (navigator.share) {
      try {
        await navigator.share({
          title: t('Driver Invite', 'دعوة سائق'),
          text: shareText,
          url: inviteUrl,
        })
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          fallbackCopy(inviteUrl)
        }
      }
    } else {
      fallbackCopy(inviteUrl)
    }
  }

  const fallbackCopy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Ignore
    }
  }

  return (
    <div className="border-t border-slate-800 px-6 py-4">
      <h3 className="mb-2 text-sm font-semibold text-slate-200">{t('Invite a driver', 'ادعُ سائقاً')}</h3>
      <p className="mb-4 text-xs text-slate-400 leading-relaxed">
        {t(
          'Share your invite link with friends. They will be linked to you automatically.',
          'شارك رابط الدعوة مع أصدقائك. سيتم ربطهم بك تلقائياً.'
        )}
      </p>
      
      <button
        type="button"
        onClick={handleShare}
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-emerald-600/20 border border-emerald-500/30 text-sm font-medium text-emerald-400 hover:bg-emerald-600/30 transition-colors"
      >
        {copied ? (
          <>
            <CheckCircle2 className="size-4" />
            {t('Link copied!', 'تم نسخ الرابط!')}
          </>
        ) : (
          <>
            {typeof navigator !== 'undefined' && !!navigator.share ? (
              <Share2 className="size-4" />
            ) : (
              <LinkIcon className="size-4" />
            )}
            {t('Share invite link', 'مشاركة رابط الدعوة')}
          </>
        )}
      </button>
    </div>
  )
}
