'use client'

import Link from 'next/link'
import { AppNav } from '@/components/saas/AppNav'
import { useLanguage } from '@/components/LanguageContext'
import { Store, Truck } from 'lucide-react'

/**
 * Shown when user has no business and no driver profile.
 * Lets them choose: Create business (tenant) or Join as driver.
 */
export function OnboardingRoleChoice({
  onChooseBusiness,
}: {
  onChooseBusiness: () => void
}) {
  const { t } = useLanguage()

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-950 text-white">
      <AppNav variant="dashboard" />

      <main className="mx-auto max-w-[100vw] px-4 py-6 sm:container sm:py-10 md:py-16">
        <div className="mx-auto max-w-lg">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold md:text-3xl">
              {t('What do you want to do?', 'ماذا تريد أن تفعل؟')}
            </h1>
            <p className="mt-2 text-slate-400 text-sm md:text-base">
              {t('Choose one option. You can always sign in with the same account later.', 'اختر خياراً واحداً. يمكنك تسجيل الدخول بنفس الحساب لاحقاً.')}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <button
              type="button"
              onClick={onChooseBusiness}
              className="flex flex-col items-center gap-4 rounded-2xl border-2 border-slate-700 bg-slate-900/60 p-6 text-left transition-colors hover:border-amber-500/60 hover:bg-slate-900"
            >
              <div className="flex size-14 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400">
                <Store className="size-7" />
              </div>
              <div>
                <h2 className="font-bold text-lg text-white">
                  {t('Create a business', 'إنشاء عمل')}
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  {t('Restaurant, cafe, salon — get your menu and orders online.', 'مطعم، مقهى، صالون — احصل على قائمتك وطلباتك أونلاين.')}
                </p>
              </div>
              <span className="mt-auto text-sm font-medium text-amber-400">
                {t('Set up your site', 'إعداد موقعك')} →
              </span>
            </button>

            <Link
              href="/driver/profile"
              className="flex flex-col items-center gap-4 rounded-2xl border-2 border-slate-700 bg-slate-900/60 p-6 text-left transition-colors hover:border-emerald-500/60 hover:bg-slate-900"
            >
              <div className="flex size-14 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400">
                <Truck className="size-7" />
              </div>
              <div>
                <h2 className="font-bold text-lg text-white">
                  {t("I'm a driver", 'أنا سائق')}
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  {t('Deliver orders and earn. Complete your driver profile.', 'وصّل الطلبات واربح. أكمل ملف السائق.')}
                </p>
              </div>
              <span className="mt-auto text-sm font-medium text-emerald-400">
                {t('Go to driver app', 'الذهاب لتطبيق السائق')} →
              </span>
            </Link>
          </div>

          <p className="mt-8 text-center">
            <Link href="/dashboard" className="text-sm text-slate-400 hover:text-white">
              ← {t('Back to dashboard', 'العودة للوحة التحكم')}
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}
