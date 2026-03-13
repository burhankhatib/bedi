'use client'

import { useState, useEffect, useRef } from 'react'
import { Share2, Link as LinkIcon, CheckCircle2 } from 'lucide-react'
import { useLanguage } from '@/components/LanguageContext'

export function DriverInviteInMenu() {
  const { t } = useLanguage()
  const [referralCode, setReferralCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const mountedRef = useRef(false)

  useEffect(() => {
    mountedRef.current = true
    const ac = new AbortController()
    fetch('/api/driver/profile', { signal: ac.signal })
      .then((res) => res.json())
      .then((data) => {
        if (!mountedRef.current || ac.signal.aborted) return
        if (data?.referralCode) {
          setReferralCode(data.referralCode)
        }
      })
      .catch((err) => {
        if ((err as Error)?.name === 'AbortError') return
      })
    return () => {
      mountedRef.current = false
      ac.abort()
    }
  }, [])

  const handleShare = async () => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://bedi.delivery'
    let inviteUrl = `${baseUrl}/driver/join`
    if (referralCode) {
      inviteUrl += `?ref=${referralCode}`
    }

    const shareText = t(
      `Join me as a delivery driver on the Bedi app!\n${inviteUrl}\n\nWhy will you love the new app?\n🚗 Receive live orders and track your route in real-time\n⏰ Freedom to work on your own schedule (work whenever you want)\n💰 Track your earnings and trips easily and transparently\n📞 Easy and direct communication with restaurants and customers\n💯 And most importantly, no one shares or takes any commissions from you, your hard work is 100% yours!`,
      
      `إنضم معي ككابتن توصيل على تطبيق بدي !\n${inviteUrl}\n\nليش رح يعجبك التطبيق الجديد ؟\n🚗 استلام الطلبات المباشرة وتتبع المسار لحظياً\n⏰ حرية اختيار أوقات العمل اللي بتناسبك (اشتغل وقت ما تحب)\n💰 تتبع أرباحك ورحلاتك بكل سهولة وشفافية\n📞 تواصل سهل ومباشر مع المطاعم والعملاء من خلال التطبيق\n💯 و الأهم مافي ولا حد بشاركك او بياخد منك اي عمولات، يعني تعبك برجعلك الك وحدك و بس !`
    )

    if (navigator.share) {
      try {
        await navigator.share({
          title: t('Driver Invite', 'دعوة سائق'),
          text: shareText,
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
