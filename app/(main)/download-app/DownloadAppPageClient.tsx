'use client'

import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'motion/react'
import {
  Download,
  Zap,
  ChevronRight,
} from 'lucide-react'
import { useLanguage } from '@/components/LanguageContext'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PublicFooter } from '@/components/saas/PublicFooter'

type PwaItem = {
  id: string
  name: string
  nameAr: string
  description: string
  descriptionAr: string
  icon: string
  installUrl: string
  installHint: string
  installHintAr: string
  apkUrl?: string
  note?: string
  noteAr?: string
}

const PWA_APPS: PwaItem[] = [
  {
    id: 'customer',
    name: 'Bedi',
    nameAr: 'بيدي',
    description: 'Order from restaurants and stores. Get order updates and track your delivery.',
    descriptionAr: 'اطلب من المطاعم والمتاجر. احصل على تحديثات الطلب وتتبع توصيلك.',
    icon: '/customersLogo.webp',
    installUrl: '/',
    apkUrl: '/apps/customer/bedi.apk',
    installHint: 'Open the homepage, then add to Home Screen or use the browser install prompt.',
    installHintAr: 'افتح الصفحة الرئيسية، ثم أضف إلى الشاشة الرئيسية أو استخدم خيار التثبيت في المتصفح.',
  },
  {
    id: 'driver',
    name: 'Bedi Driver',
    nameAr: 'بيدي للسائقين',
    description: 'Receive and manage delivery orders. Get new order alerts and go-online reminders.',
    descriptionAr: 'استلم وادِر طلبات التوصيل. احصل على تنبيهات الطلبات الجديدة وتذكيرات التشغيل.',
    icon: '/driversLogo.webp',
    installUrl: '/driver',
    apkUrl: '/apps/driver/bedi-driver.apk',
    installHint: 'Open the Driver app, then use your browser menu to install.',
    installHintAr: 'افتح تطبيق السائق، ثم استخدم قائمة المتصفح للتثبيت.',
    note: 'This is only for users who registered for free as a driver. Start making extra money without any hidden or extra fees.',
    noteAr: 'هذا فقط للمستخدمين المسجلين مجاناً كسائقين. ابدأ بكسب أموال إضافية بدون رسوم خفية أو إضافية.',
  },
  {
    id: 'per-business',
    name: 'Business Orders',
    nameAr: 'طلبات المتجر',
    description: 'A dedicated app per business with your own logo and name. Receive FCM push notifications exclusively for that business — new orders, status updates, table requests — even when your screen is off.',
    descriptionAr: 'تطبيق مستقل لكل متجر بشعارك واسمك. استلم إشعارات FCM لهذا المتجر فقط — طلبات جديدة، تحديثات الحالة، طلبات الطاولة — حتى عند إغلاق الشاشة.',
    icon: '/adminslogo.webp',
    installUrl: '/dashboard',
    apkUrl: '/apps/tenant/bedi-tenant.apk',
    installHint: 'Sign in → open your business Orders page → tap the install banner that appears at the bottom → follow the prompt. Each business installs as its own separate app.',
    installHintAr: 'سجّل الدخول → افتح صفحة الطلبات لمتجرك → اضغط على شريط التثبيت الذي يظهر أسفل الصفحة → اتبع التعليمات. كل متجر يُثبَّت كتطبيق مستقل.',
    note: 'This is only for registered tenants. Start your store today for free — no hidden fees, no app store approval needed. Own your brand and receive instant order alerts.',
    noteAr: 'هذا فقط للمتاجر المسجّلة. افتح متجرك اليوم مجاناً — بدون رسوم خفية، بدون انتظار موافقة متجر التطبيقات. امتلك علامتك التجارية واستلم تنبيهات الطلبات فورياً.',
  },
]

export function DownloadAppPageClient() {
  const { t, lang } = useLanguage()
  const isRtl = lang === 'ar'

  const title = t('Download the app', 'تحميل التطبيق')
  const subtitle = t(
    'Install the right app for you — no app store required. Fast, up to date, and ready on all your devices.',
    'ثبّت التطبيق المناسب لك — بدون متجر تطبيقات. سريع، محدّث، وجاهز على جميع أجهزتك.'
  )
  const whyTitle = t('Why install as an app?', 'لماذا التثبيت كتطبيق؟')
  const whyPoints = [
    { en: 'No app store — install in one tap from your browser.', ar: 'بدون متجر تطبيقات — ثبّت بنقرة واحدة من المتصفح.' },
    { en: 'Always up to date — you get the latest version automatically.', ar: 'دائماً محدّث — تحصل على أحدث نسخة تلقائياً.' },
    { en: 'Push notifications — order updates, new orders, and reminders.', ar: 'إشعارات فورية — تحديثات الطلب، الطلبات الجديدة، والتذكيرات.' },
    { en: 'Works on your phone, tablet, and computer with one account.', ar: 'يعمل على هاتفك وجهازك اللوحي وحاسوبك بحساب واحد.' },
  ]
  const androidTitle = t('Android', 'أندرويد')
  const androidSteps = t(
    'Open the link below in Chrome, then tap the menu (⋮) → "Install app" or "Add to Home screen".',
    'افتح الرابط أدناه في Chrome، ثم اضغط القائمة (⋮) → "تثبيت التطبيق" أو "إضافة إلى الشاشة الرئيسية".'
  )
  const iosTitle = t('iPhone & iPad', 'آيفون وآيباد')
  const iosSteps = t(
    'Open the link in Safari → tap the Share button → "Add to Home Screen" → name it and tap Add.',
    'افتح الرابط في Safari → اضغط زر المشاركة → "إضافة إلى الشاشة الرئيسية" → سمّه واضغط إضافة.'
  )
  const openToInstall = t('Open to install', 'افتح للتثبيت')

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
        <motion.header
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-14 text-center"
        >
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {title}
          </h1>
          <p className="mt-4 text-lg text-slate-400">
            {subtitle}
          </p>
        </motion.header>

        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          className="mb-16 rounded-2xl border border-slate-700/60 bg-slate-900/80 p-6 shadow-xl sm:p-8"
        >
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-amber-400">
            <Zap className="size-5 shrink-0" />
            {whyTitle}
          </h2>
          <ul className="space-y-3">
            {whyPoints.map((point, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: isRtl ? 12 : -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + i * 0.08, duration: 0.3 }}
                className="flex items-start gap-3 text-slate-300"
              >
                <span className="mt-1 size-1.5 shrink-0 rounded-full bg-amber-400" aria-hidden />
                <span>{isRtl ? point.ar : point.en}</span>
              </motion.li>
            ))}
          </ul>
        </motion.section>

        <section className="grid gap-6 sm:grid-cols-2">
          {PWA_APPS.map((app, index) => (
            <motion.div
              key={app.id}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 + index * 0.1, duration: 0.4 }}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.99 }}
            >
              <Card className="h-full overflow-hidden border-slate-700/60 bg-slate-900/50 shadow-lg transition-shadow hover:shadow-xl">
                <CardHeader className="flex flex-row items-start gap-4 pb-2">
                  <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-800 shadow-inner">
                    <Image
                      src={app.icon}
                      alt=""
                      width={56}
                      height={56}
                      className="object-contain"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-xl text-white">
                      {isRtl ? app.nameAr : app.name}
                    </CardTitle>
                    <CardDescription className="mt-1 text-slate-400">
                      {isRtl ? app.descriptionAr : app.description}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-0">
                  <p className="text-sm text-slate-500">
                    {isRtl ? app.installHintAr : app.installHint}
                  </p>
                  <div className="rounded-lg border border-slate-700/60 bg-slate-800/50 p-4 text-sm">
                    <p className="mb-2 font-medium text-slate-300">{androidTitle}</p>
                    <p className="text-slate-400">{androidSteps}</p>
                    <p className="mt-3 font-medium text-slate-300">{iosTitle}</p>
                    <p className="text-slate-400">{iosSteps}</p>
                  </div>
                  {(app.note || app.noteAr) && (
                    <div className="rounded-lg bg-amber-500/10 p-3 text-xs text-amber-200/90 border border-amber-500/20">
                      {isRtl ? app.noteAr : app.note}
                    </div>
                  )}
                </CardContent>
                <CardFooter className="flex-col gap-3 pt-0">
                  <Button
                    asChild
                    size="lg"
                    className="w-full gap-2 bg-amber-500 text-slate-950 shadow-md hover:bg-amber-400 focus-visible:ring-amber-500/30"
                  >
                    <a href={app.installUrl} className="inline-flex items-center justify-center">
                      <Download className="size-5 shrink-0" />
                      {openToInstall}
                      <ChevronRight
                        className="size-5 shrink-0"
                        style={isRtl ? { transform: 'scaleX(-1)' } : undefined}
                      />
                    </a>
                  </Button>

                  {app.apkUrl && (
                    <Button
                      asChild
                      size="lg"
                      variant="outline"
                      className="w-full gap-2 border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white"
                    >
                      <a href={app.apkUrl} download className="inline-flex items-center justify-center">
                        <svg className="size-5 shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path d="M3.5,2.1C3.2,2.4 3,3 3,3.7V20.3C3,21 3.2,21.6 3.5,21.9L3.6,22L14.3,11.3L14.4,11.2L14.3,11.1L3.6,0.4L3.5,0.5L3.5,2.1Z" fill="#4CAF50"/>
                          <path d="M17.9,14.8L14.4,11.2L14.4,11.1L14.4,11L17.9,7.5L18,7.6L21.3,9.5C22.2,10 22.2,10.9 21.3,11.4L18,13.3L17.9,14.8Z" fill="#FFC107"/>
                          <path d="M14.4,11.2L3.5,21.9C3.9,22.3 4.5,22.3 5.3,21.9L17.9,14.8L14.4,11.2Z" fill="#F44336"/>
                          <path d="M14.4,11.1L3.5,0.5C3.9,0.1 4.5,0 5.3,0.5L17.9,7.5L14.4,11.1Z" fill="#2196F3"/>
                        </svg>
                        <span className="font-semibold">{isRtl ? 'تطبيق أندرويد (APK)' : 'Android App (APK)'}</span>
                      </a>
                    </Button>
                  )}
                </CardFooter>
              </Card>
            </motion.div>
          ))}
        </section>
      </div>
      <PublicFooter />
    </div>
  )
}
