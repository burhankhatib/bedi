'use client'

import Image from 'next/image'
import { motion } from 'motion/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SUBSCRIPTION_PLANS, BILLING_PLAN_IDS, type PlanId } from '@/lib/subscription'
const BOP_COLOR = '#aa2267'

type T = (en: string, ar: string) => string

export function BankOfPalestineCard({ t, isRtl }: { t: T; isRtl: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      <Card
        className="overflow-hidden border-2 transition-all hover:shadow-lg"
        style={{
          borderColor: `${BOP_COLOR}60`,
          backgroundColor: `${BOP_COLOR}08`,
        }}
      >
        <CardHeader className="pb-3" dir={isRtl ? 'rtl' : 'ltr'}>
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative h-20 w-44 shrink-0 sm:h-24 sm:w-52">
              <Image
                src="/bopLogo.png"
                alt="Bank of Palestine"
                fill
                className={`object-contain ${isRtl ? 'object-right' : 'object-left'}`}
              />
            </div>
            <div>
              <CardTitle className="text-xl text-white" style={{ color: BOP_COLOR }}>
                {t('Pay with Bank of Palestine', 'الدفع عبر بنك فلسطين')}
              </CardTitle>
              <CardDescription className="mt-0.5 text-slate-400">
                {t('Use the Bank of Palestine app to scan the QR code and pay.', 'استخدم تطبيق بنك فلسطين لمسح رمز QR والدفع.')}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6" dir={isRtl ? 'rtl' : 'ltr'}>
          <div>
            <h4 className="mb-2 font-semibold text-white">
              {t('Step by step', 'خطوة بخطوة')}:
            </h4>
            <ol className="list-inside list-decimal space-y-2 text-sm text-slate-300">
              <li>
                {t('Open the Bank of Palestine application on your phone.', 'افتح تطبيق بنك فلسطين على هاتفك.')}
              </li>
              <li>
                {t('Choose "QR code scan" or "Scan to pay".', 'اختر "مسح رمز QR" أو "امسح للدفع".')}
              </li>
              <li>
                {t('Scan the QR code below with the app.', 'امسح رمز QR أدناه باستخدام التطبيق.')}
              </li>
              <li>
                {t('Pay according to the plan you want (see prices below).', 'ادفع حسب الخطة التي تريدها (انظر الأسعار أدناه).')}
              </li>
            </ol>
          </div>

          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <motion.div
              initial={{ scale: 0.96 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.15, duration: 0.3 }}
              className="rounded-2xl border-2 bg-white p-4"
              style={{ borderColor: BOP_COLOR }}
            >
              <p className="mb-2 text-center text-xs font-medium text-slate-600">
                {t('Scan to pay', 'امسح للدفع')}
              </p>
              <div className="relative h-56 w-56 sm:h-64 sm:w-64">
                <Image
                  src="/bopQRcode.png"
                  alt="Bank of Palestine QR code for payment"
                  fill
                  className="rounded-lg object-contain"
                />
              </div>
            </motion.div>

            <div className="flex-1 rounded-xl border border-slate-600/60 bg-slate-800/50 p-4">
              <p className="mb-3 text-base font-medium text-white sm:text-lg">
                {t('Plans and prices (pay this amount or more)', 'الباقات والأسعار (ادفع هذا المبلغ أو أكثر)')}:
              </p>
              <ul className="space-y-3 text-base text-slate-300 sm:text-lg">
                {BILLING_PLAN_IDS.map((planId) => {
                  const plan = SUBSCRIPTION_PLANS[planId]
                  return (
                    <li key={planId} className="flex justify-between gap-3">
                      <span>{t(plan.labelEn, plan.labelAr)}</span>
                      <span className="text-lg font-bold sm:text-xl" style={{ color: BOP_COLOR }}>
                        {plan.priceIls} ILS
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
