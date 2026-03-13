'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { MapPin, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
import { useLanguage } from '@/components/LanguageContext'
import { useDriverPush } from './DriverPushContext'

/** Detect Samsung browser/device for device-specific instructions. */
function isSamsungBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent.toLowerCase()
  return (
    ua.includes('samsung') ||
    ua.includes('samsungbrowser') ||
    (ua.includes('android') && ua.includes('sm-'))
  )
}

function isAndroid(): boolean {
  if (typeof navigator === 'undefined') return false
  return /android/i.test(navigator.userAgent)
}

export function DriverLocationSetup() {
  const { t } = useLanguage()
  const {
    hasLocation,
    locationChecked,
    locationLoading,
    requestLocation,
  } = useDriverPush()
  const [showInstructions, setShowInstructions] = useState(false)

  if (!locationChecked) return null
  if (hasLocation) return null

  const isSamsung = isSamsungBrowser()
  const isAndroidDevice = isAndroid()

  const title = t('Enable location required', 'تفعيل الموقع مطلوب')
  const body = t(
    'Location is required to receive orders, appear on the map, and complete deliveries. Enable it to continue.',
    'الموقع مطلوب لاستقبال الطلبات والظهور على الخريطة وإتمام التوصيلات. فعّله للمتابعة.'
  )
  const enableBtn = t('Enable Location', 'تفعيل الموقع')
  const enablingBtn = t('Getting location…', 'جاري تحديد الموقع…')
  const howToEnable = t('How to enable manually', 'كيفية التفعيل يدوياً')

  const samsungSteps = t(
    'Samsung: Settings → Apps → Bedi Driver (or your browser) → Permissions → Location → Allow. Or: open browser menu (⋮) → Settings → Site permissions → Location → Allow.',
    'Samsung: الإعدادات ← التطبيقات ← Bedi Driver (أو متصفحك) ← الأذونات ← الموقع ← السماح. أو: قائمة المتصفح (⋮) ← الإعدادات ← صلاحيات الموقع ← الموقع ← السماح.'
  )
  const androidSteps = t(
    'Android: Long-press the link/icon → App info → Permissions → Location → Allow. Or: Chrome menu → Settings → Site settings → Location.',
    'Android: اضغط مطولاً على الرابط ← معلومات التطبيق ← الأذونات ← الموقع ← السماح. أو: قائمة Chrome ← الإعدادات ← إعدادات الموقع.'
  )
  const generalSteps = t(
    'Open your device Settings → find this app or your browser → Permissions → allow Location. Then return here and tap Enable.',
    'افتح إعدادات الجهاز ← ابحث عن التطبيق أو المتصفح ← الأذونات ← اسمح بالموقع. ثم ارجع هنا واضغط تفعيل.'
  )

  const instructions =
    isSamsung ? samsungSteps : isAndroidDevice ? androidSteps : generalSteps

  return (
    <div className="mb-4 rounded-xl border border-blue-600/60 bg-blue-950/40 p-4">
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-blue-200">{title}</p>
        <p className="text-sm text-blue-200/90">{body}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="default"
            disabled={locationLoading}
            className="min-h-[44px] min-w-[44px] touch-manipulation bg-blue-600 hover:bg-blue-500 text-white font-medium"
            onClick={() => requestLocation()}
          >
            <MapPin className="ml-1.5 size-4 shrink-0" />
            {locationLoading ? enablingBtn : enableBtn}
          </Button>
        </div>
        <button
          type="button"
          onClick={() => setShowInstructions((s) => !s)}
          className="flex items-center gap-2 text-xs font-medium text-blue-300 hover:text-blue-200"
        >
          {showInstructions ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          {howToEnable}
        </button>
        {showInstructions && (
          <div className="rounded-lg border border-blue-500/40 bg-blue-950/50 px-4 py-3 text-xs text-blue-200/90">
            <p className="whitespace-pre-wrap">{instructions}</p>
            {isSamsung && (
              <p className="mt-2 text-blue-300/80">
                {t(
                  'Tip: On Samsung, location can take 10–20 seconds. Wait and keep the app open.',
                  'نصيحة: على Samsung قد يستغرق الموقع 10–20 ثانية. انتظر وأبقِ التطبيق مفتوحاً.'
                )}
              </p>
            )}
            <a
              href="https://support.google.com/chrome/answer/142065"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 underline"
            >
              {t('Chrome location help', 'مساعدة Chrome للموقع')}
              <ExternalLink className="size-3" />
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
