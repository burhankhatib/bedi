'use client'

import { useState, useEffect } from 'react'
import { MessageCircle } from 'lucide-react'
import { useLanguage } from '@/components/LanguageContext'
import { getWhatsAppUrl } from '@/lib/whatsapp'
import { getDriverInviteMessageAr } from '@/lib/driver-invite'

export function DriverInviteInMenu() {
  const { t, lang } = useLanguage()
  const [inviteName, setInviteName] = useState('')
  const [invitePhone, setInvitePhone] = useState('')
  const [referralCode, setReferralCode] = useState<string | null>(null)

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

  const openInviteWhatsApp = () => {
    let inviteUrl = `https://bedi.delivery/driver/join`
    if (referralCode) {
      inviteUrl += `?ref=${referralCode}`
    }
    const message = getDriverInviteMessageAr(inviteName, inviteUrl)
    const url = getWhatsAppUrl(invitePhone, message)
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="border-t border-slate-800 px-6 py-4">
      <h3 className="mb-2 text-sm font-semibold text-slate-200">{t('Invite a driver', 'ادعُ سائقاً')}</h3>
      <p className="mb-3 text-xs text-slate-400">
        {t('Invite a friend via WhatsApp.', 'ادعُ صديقاً عبر واتساب.')}
      </p>
      <div className="space-y-2">
        <input
          type="text"
          value={inviteName}
          onChange={(e) => setInviteName(e.target.value)}
          placeholder={lang === 'ar' ? 'الاسم' : 'Name'}
          className="h-9 w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-white placeholder:text-slate-500"
        />
        <input
          type="text"
          value={invitePhone}
          onChange={(e) => setInvitePhone(e.target.value)}
          placeholder="+972501234567"
          className="h-9 w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-white placeholder:text-slate-500"
        />
        <button
          type="button"
          onClick={openInviteWhatsApp}
          disabled={!invitePhone.trim()}
          className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-[#25D366] text-sm font-medium text-white hover:bg-[#20bd5a] disabled:opacity-50 disabled:pointer-events-none"
        >
          <MessageCircle className="size-4" />
          {t('Send WhatsApp invite', 'إرسال دعوة واتساب')}
        </button>
      </div>
    </div>
  )
}
