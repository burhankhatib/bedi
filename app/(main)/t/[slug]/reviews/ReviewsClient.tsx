'use client'

import { useLanguage } from '@/components/LanguageContext'
import { EntityRatingBadge } from '@/components/rating/EntityRatingBadge'
import { Star, ArrowLeft, ArrowRight, User } from 'lucide-react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { arSA } from 'date-fns/locale'

export function maskCustomerName(name: string | null | undefined): string {
  if (!name) return 'A***'
  const trimmed = name.trim()
  if (!trimmed) return 'A***'
  
  const firstChar = trimmed.charAt(0).toUpperCase()
  return `${firstChar}***`
}

export default function ReviewsClient({ tenant, aggregate, initialReviews }: any) {
  const { t, lang } = useLanguage()
  
  const restaurantInfo = tenant.restaurantInfo
  const name = (lang === 'ar' ? restaurantInfo?.name_ar : restaurantInfo?.name_en) || tenant.name

  return (
    <div className="min-h-screen bg-slate-50" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 px-4 py-3 sm:py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Link href={`/t/${tenant.slug}`} className="p-2 -ml-2 rounded-full hover:bg-slate-100 transition-colors">
            {lang === 'ar' ? <ArrowRight className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-slate-900">{name}</h1>
            <p className="text-sm text-slate-500">{t('Customer Reviews', 'تقييمات العملاء')}</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {aggregate ? (
          <div className="bg-white rounded-3xl p-8 mb-8 text-center border border-slate-100 shadow-sm flex flex-col items-center">
            <div className="text-5xl font-black text-slate-900 mb-2">
              {aggregate.averageScore.toFixed(1)}
            </div>
            <div className="flex items-center gap-1 text-amber-500 mb-2">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star key={s} className={`w-6 h-6 ${s <= Math.round(aggregate.averageScore) ? 'fill-current' : 'text-slate-200'}`} />
              ))}
            </div>
            <div className="text-slate-500 font-medium">
              {t('Based on', 'بناءً على')} {aggregate.totalCount} {t('reviews', 'تقييم')}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-3xl p-8 mb-8 text-center border border-slate-100 shadow-sm">
            <p className="text-slate-500">{t('No reviews yet.', 'لا توجد تقييمات بعد.')}</p>
          </div>
        )}

        <div className="space-y-4">
          {initialReviews.length > 0 ? (
            initialReviews.map((review: any) => (
              <div key={review.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900 text-sm">
                        {review.raterRole === 'customer' ? t('Customer', 'عميل') + ' ' + maskCustomerName(review.raterName) : t('Driver', 'سائق')}
                      </div>
                      <div className="text-xs text-slate-400">
                        {formatDistanceToNow(review.updatedAtMs, { addSuffix: true, locale: lang === 'ar' ? arSA : undefined })}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-amber-500">
                    <Star className="w-4 h-4 fill-current" />
                    <span className="font-bold text-sm">{review.score}</span>
                  </div>
                </div>
                {review.feedback && (
                  <p className="text-slate-700 text-sm leading-relaxed mt-2">
                    {review.feedback}
                  </p>
                )}
                {review.orderType && (
                  <div className="mt-3 inline-flex items-center rounded-md bg-slate-50 px-2 py-1 text-xs font-medium text-slate-500 ring-1 ring-inset ring-slate-200">
                    {review.orderType === 'delivery' ? t('Delivery', 'توصيل') : review.orderType === 'pickup' ? t('Pickup', 'استلام') : t('Dine-in', 'محلي')}
                  </div>
                )}
              </div>
            ))
          ) : null}
        </div>
      </main>
    </div>
  )
}
