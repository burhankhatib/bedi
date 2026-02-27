'use client'

import { useRef, useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { Button } from '@/components/ui/button'
import { Download, Copy, Check } from 'lucide-react'
import { useLanguage } from '@/components/LanguageContext'
import {
  FacebookShareButton,
  WhatsappShareButton,
  FacebookIcon,
  WhatsappIcon,
} from 'react-share'

interface TenantQRCodeProps {
  /** Full URL to the tenant menu (e.g. https://example.com/t/my-restaurant) */
  menuUrl: string
  /** Tenant slug, used for download filename */
  slug: string
}

const SHARE_BUTTON_SIZE = 40

export function TenantQRCode({ menuUrl, slug }: TenantQRCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { t } = useLanguage()
  const [copied, setCopied] = useState(false)

  const handleDownload = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const png = canvas.toDataURL('image/png')
    const link = document.createElement('a')
    link.href = png
    link.download = `qr-menu-${slug}.png`
    link.click()
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(menuUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback for older browsers
      const input = document.createElement('input')
      input.value = menuUrl
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const shareTitle = t('Check out our menu', 'اطّلع على قائمتنا')

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <p className="mb-3 text-sm font-medium text-slate-300">
        {t('Menu QR Code — scan to open menu', 'رمز QR للقائمة — امسح لفتح القائمة')}
      </p>
      <div className="mb-3 flex justify-center rounded-xl bg-white p-4">
        <QRCodeCanvas
          ref={canvasRef}
          value={menuUrl}
          size={200}
          level="H"
          includeMargin
        />
      </div>

      {/* Link to share + Copy button */}
      <div className="mb-3 rounded-lg border border-slate-700/50 bg-slate-800/40 px-3 py-2">
        <p className="mb-2 text-xs font-medium text-slate-400">
          {t('Link to share with clients', 'رابط لمشاركته مع العملاء')}
        </p>
        <p className="mb-2 break-all text-sm text-slate-200" title={menuUrl}>
          {menuUrl}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleCopyLink}
          className="w-full border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white"
        >
          {copied ? (
            <>
              <Check className="me-2 size-4 text-emerald-400" />
              {t('Copied!', 'تم النسخ!')}
            </>
          ) : (
            <>
              <Copy className="me-2 size-4" />
              {t('Copy link', 'نسخ الرابط')}
            </>
          )}
        </Button>
      </div>

      {/* Share to social */}
      <div className="mb-3">
        <p className="mb-2 text-xs font-medium text-slate-400">
          {t('Share to social media', 'مشاركة على وسائل التواصل')}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <FacebookShareButton
            url={menuUrl}
            className="focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 rounded-lg overflow-hidden"
          >
            <FacebookIcon size={SHARE_BUTTON_SIZE} round />
          </FacebookShareButton>
          <WhatsappShareButton
            url={menuUrl}
            title={shareTitle}
            separator=" — "
            className="focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 rounded-lg overflow-hidden"
          >
            <WhatsappIcon size={SHARE_BUTTON_SIZE} round />
          </WhatsappShareButton>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleCopyLink}
            className="size-10 shrink-0 rounded-full border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white"
            title={t('Copy link to share on Instagram (paste in bio or story)', 'نسخ الرابط لمشاركته على إنستغرام')}
          >
            <svg className="size-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
            </svg>
          </Button>
        </div>
        <p className="mt-1.5 text-xs text-slate-500">
          {t('Instagram: copy the link above and paste it in your bio or story.', 'إنستغرام: انسخ الرابط أعلاه والصقه في الوصف أو القصة.')}
        </p>
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleDownload}
        className="w-full border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white"
      >
        <Download className="me-2 size-4" />
        {t('Download to print', 'تحميل للطباعة')}
      </Button>
    </div>
  )
}
