'use client'

import Link from 'next/link'
import { motion } from 'motion/react'
import { useLanguage } from '@/components/LanguageContext'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Store,
  Truck,
  Menu,
  ClipboardList,
  Zap,
  LogIn,
  UserPlus,
  MapPin,
  Banknote,
} from 'lucide-react'

const container = {
  hidden: { opacity: 0 },
  visible: (i = 1) => ({
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.04 * i },
  }),
}

const item = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: 'easeOut' as const },
  },
}

const float = {
  initial: { y: 0 },
  animate: {
    y: [0, -6, 0],
    transition: { duration: 4, repeat: Infinity, ease: 'easeInOut' as const },
  },
}

export function HomePageAuthSections() {
  const { t, lang } = useLanguage()
  const isRtl = lang === 'ar'

  return (
    <section className="mt-16 space-y-20 pb-16 md:mt-24 md:space-y-28" aria-label={t('Sign in or sign up', 'تسجيل الدخول أو إنشاء حساب')}>
      {/* ─── For Businesses (Tenants) ─── */}
      <motion.div
        id="for-businesses"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-80px' }}
        variants={container}
        className="scroll-mt-20"
      >
        <div className="mx-auto max-w-5xl">
          <motion.div
            variants={item}
            className="mb-8 flex flex-col items-center gap-2 text-center"
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-1.5 text-sm font-medium text-amber-800">
              <Store className="size-4" />
              {t('For businesses', 'للأعمال')}
            </span>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
              {t('Get your menu online. Accept orders in minutes.', 'انشر قائمتك أونلاين. استقبل الطلبات خلال دقائق.')}
            </h2>
            <p className="max-w-xl text-slate-600">
              {t(
                'Restaurants, cafes, salons and more — one link, dine-in and delivery orders, no app store.',
                'مطاعم، مقاهي، صالونات والمزيد — رابط واحد، طلبات جلوس وتوصيل، بدون متجر تطبيقات.'
              )}
            </p>
          </motion.div>

          <motion.div variants={item}>
            <Card className="overflow-hidden border-amber-200/60 bg-gradient-to-br from-amber-50/80 to-white shadow-lg shadow-amber-500/5 transition-shadow hover:shadow-xl hover:shadow-amber-500/10">
              <CardHeader className="pb-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="text-xl text-slate-900 md:text-2xl">
                      {t('Create your business account', 'إنشاء حساب أعمال')}
                    </CardTitle>
                    <CardDescription className="mt-1.5 text-slate-600">
                      {t('Sign up or sign in to manage your menu and orders.', 'سجّل أو ادخل لإدارة قائمتك وطلباتك.')}
                    </CardDescription>
                  </div>
                  <motion.div
                    variants={float}
                    initial="initial"
                    animate="animate"
                    className="hidden shrink-0 sm:block"
                  >
                    <div className="flex size-16 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-600">
                      <Store className="size-8" />
                    </div>
                  </motion.div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <ul className="grid gap-3 sm:grid-cols-3">
                  {[
                    { icon: Menu, text: t('Digital menu & link', 'قائمة رقمية ورابط'), textAr: 'قائمة رقمية ورابط' },
                    { icon: ClipboardList, text: t('Orders dashboard', 'لوحة الطلبات'), textAr: 'لوحة الطلبات' },
                    { icon: Zap, text: t('Dine-in & delivery', 'جلوس وتوصيل'), textAr: 'جلوس وتوصيل' },
                  ].map(({ icon: Icon, text, textAr }, i) => (
                    <motion.li
                      key={i}
                      variants={item}
                      className="flex items-center gap-3 rounded-xl border border-amber-100 bg-white/60 px-4 py-3"
                    >
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600">
                        <Icon className="size-4" />
                      </div>
                      <span className="text-sm font-medium text-slate-700">{isRtl ? textAr : text}</span>
                    </motion.li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter className="flex flex-wrap gap-3 border-t border-amber-100/80 bg-amber-50/30 pt-6">
                <Button asChild size="lg" className="gap-2 rounded-xl bg-amber-500 text-slate-950 shadow-md hover:bg-amber-400">
                  <Link href="/sign-up?redirect_url=/">
                    <UserPlus className="size-5" />
                    {t('Sign up (Business)', 'تسجيل (أعمال)')}
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="gap-2 rounded-xl border-amber-300 bg-white text-slate-900 hover:bg-amber-50 hover:text-slate-900">
                  <Link href="/sign-in?redirect_url=/">
                    <LogIn className="size-5" />
                    {t('Sign in (Business)', 'دخول (أعمال)')}
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          </motion.div>
        </div>
      </motion.div>

      {/* ─── For Drivers ─── */}
      <motion.div
        id="for-drivers"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-80px' }}
        variants={container}
        className="scroll-mt-20"
      >
        <div className="mx-auto max-w-5xl">
          <motion.div
            variants={item}
            className="mb-8 flex flex-col items-center gap-2 text-center"
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-sm font-medium text-emerald-800">
              <Truck className="size-4" />
              {t('For drivers', 'للسائقين')}
            </span>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
              {t('Deliver orders. Earn on your schedule.', 'وصّل الطلبات. اربح حسب وقتك.')}
            </h2>
            <p className="max-w-xl text-slate-600">
              {t(
                'Join the driver app, get orders in your area, and get paid. Enable notifications to receive new orders.',
                'انضم لتطبيق السائقين، استلم طلبات في منطقتك واربح. فعّل الإشعارات لاستقبال طلبات جديدة.'
              )}
            </p>
          </motion.div>

          <motion.div variants={item}>
            <Card className="overflow-hidden border-emerald-200/60 bg-gradient-to-br from-emerald-50/80 to-white shadow-lg shadow-emerald-500/5 transition-shadow hover:shadow-xl hover:shadow-emerald-500/10">
              <CardHeader className="pb-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="text-xl text-slate-900 md:text-2xl">
                      {t('Join as a driver', 'انضم كسائق')}
                    </CardTitle>
                    <CardDescription className="mt-1.5 text-slate-600">
                      {t('Sign up or sign in to the driver app and start receiving orders.', 'سجّل أو ادخل لتطبيق السائقين وابدأ باستقبال الطلبات.')}
                    </CardDescription>
                  </div>
                  <motion.div
                    variants={float}
                    initial="initial"
                    animate="animate"
                    className="hidden shrink-0 sm:block"
                  >
                    <div className="flex size-16 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-600">
                      <Truck className="size-8" />
                    </div>
                  </motion.div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <ul className="grid gap-3 sm:grid-cols-3">
                  {[
                    { icon: MapPin, text: t('Orders in your area', 'طلبات في منطقتك'), textAr: 'طلبات في منطقتك' },
                    { icon: Zap, text: t('Real-time notifications', 'إشعارات فورية'), textAr: 'إشعارات فورية' },
                    { icon: Banknote, text: t('Get paid per delivery', 'ادفع لكل توصيل'), textAr: 'ادفع لكل توصيل' },
                  ].map(({ icon: Icon, text, textAr }, i) => (
                    <motion.li
                      key={i}
                      variants={item}
                      className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-white/60 px-4 py-3"
                    >
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600">
                        <Icon className="size-4" />
                      </div>
                      <span className="text-sm font-medium text-slate-700">{isRtl ? textAr : text}</span>
                    </motion.li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter className="flex flex-wrap gap-3 border-t border-emerald-100/80 bg-emerald-50/30 pt-6">
                <Button asChild size="lg" className="gap-2 rounded-xl bg-emerald-600 text-white shadow-md hover:bg-emerald-500">
                  <Link href="/sign-up?redirect_url=/">
                    <UserPlus className="size-5" />
                    {t('Sign up (Driver)', 'تسجيل (سائق)')}
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="gap-2 rounded-xl border-emerald-300 bg-white text-slate-900 hover:bg-emerald-50 hover:text-slate-900">
                  <Link href="/sign-in?redirect_url=/driver">
                    <LogIn className="size-5" />
                    {t('Sign in (Driver)', 'دخول (سائق)')}
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          </motion.div>
        </div>
      </motion.div>
    </section>
  )
}
