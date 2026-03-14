'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'motion/react'
import { useLanguage } from '@/components/LanguageContext'
import { MessageCircle, Trash2, Sparkles, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { QuestionRow } from './page'


export function MyQuestionsClient({ initialQuestions }: { initialQuestions: QuestionRow[] }) {
  const { t, lang } = useLanguage()
  const [questions, setQuestions] = useState<QuestionRow[]>(initialQuestions)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [clearingAll, setClearingAll] = useState(false)

  const handleDeleteOne = useCallback(async (id: string) => {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/me/search-questions?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (res.ok) setQuestions((prev) => prev.filter((q) => q._id !== id))
    } finally {
      setDeletingId(null)
    }
  }, [])

  const handleClearAll = useCallback(async () => {
    setClearingAll(true)
    try {
      const res = await fetch('/api/me/search-questions', {
        method: 'DELETE',
        credentials: 'include',
      })
      if (res.ok) setQuestions([])
    } finally {
      setClearingAll(false)
    }
  }, [])

  return (
    <div className="min-h-screen bg-slate-50 pb-24 md:pb-8">
      <div className="mx-auto max-w-2xl px-4 py-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">
          {t('Search history', 'سجل البحث')}
        </h1>
        <p className="text-slate-500 text-sm mb-6">
          {t('Questions you asked the AI assistant. Used to personalize future suggestions.', 'الأسئلة التي طرحتها على المساعد الذكي. تُستخدم لتخصيص الاقتراحات المستقبلية.')}
        </p>

        {questions.length > 0 && (
          <div className="flex justify-end mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearAll}
              disabled={clearingAll}
              className="gap-2 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
            >
              {clearingAll ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              {t('Clear all', 'مسح الكل')}
            </Button>
          </div>
        )}

        <section className="space-y-2">
          <AnimatePresence mode="popLayout">
            {questions.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500"
              >
                <MessageCircle className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                <p>{t('No search questions yet.', 'لا توجد أسئلة بحث بعد.')}</p>
                <p className="text-sm mt-1">{t('Ask the AI in the search bar to get started.', 'اسأل الذكاء الاصطناعي في شريط البحث للبدء.')}</p>
                <Link
                  href="/search?expand=1"
                  className="inline-flex items-center gap-2 mt-4 text-amber-600 font-medium hover:text-amber-700"
                >
                  <Sparkles className="size-4" />
                  {t('Try AI search', 'جرب البحث بالذكاء الاصطناعي')}
                </Link>
              </motion.div>
            ) : (
              questions.map((q) => (
                <motion.div
                  key={q._id}
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start gap-3" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-900 break-words">{q.question}</p>
                      {q.askedAt && <p className="text-xs text-slate-500 mt-1">{new Date(q.askedAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteOne(q._id)}
                      disabled={deletingId === q._id}
                      className="shrink-0 p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors touch-manipulation"
                      aria-label={t('Delete', 'حذف')}
                    >
                      {deletingId === q._id ? (
                        <Loader2 className="size-5 animate-spin" />
                      ) : (
                        <Trash2 className="size-5" />
                      )}
                    </button>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </section>
      </div>
    </div>
  )
}
