'use client'

import { useState, useEffect, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useLanguage } from '@/components/LanguageContext'
import { Edit2 } from 'lucide-react'

interface CustomerInfoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialName?: string
  initialTable?: string
  onSubmit: (name: string, table: string) => void
}

export function CustomerInfoDialog({
  open,
  onOpenChange,
  initialName = '',
  initialTable = '',
  onSubmit
}: CustomerInfoDialogProps) {
  const { t } = useLanguage()
  const [formName, setFormName] = useState('')
  const [formTable, setFormTable] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)

  // Initialize form values when dialog opens
  useEffect(() => {
    if (open) {
      setFormName(initialName)
      setFormTable(initialTable)
      // Auto-focus first input after dialog opens
      setTimeout(() => {
        nameInputRef.current?.focus()
      }, 100)
    }
  }, [open, initialName, initialTable])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (formName.trim() && formTable.trim()) {
      onSubmit(formName.trim(), formTable.trim())
      onOpenChange(false)
    }
  }

  const handleCancel = () => {
    setFormName(initialName)
    setFormTable(initialTable)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md w-[95%] rounded-[32px] p-8 border-none shadow-2xl pb-[max(2rem,calc(env(safe-area-inset-bottom)+100px))]"
        onOpenAutoFocus={(e) => {
          // Focus after animation
          e.preventDefault()
          setTimeout(() => {
            nameInputRef.current?.focus()
          }, 300)
        }}
      >
        <DialogHeader className="mb-6">
          <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center mb-4">
            <Edit2 className="w-6 h-6 text-white" />
          </div>
          <DialogTitle className="text-2xl font-black">
            {t('Dine-in Details', 'تفاصيل تناول الطعام')}
          </DialogTitle>
          <DialogDescription className="font-medium text-slate-500">
            {t('Please enter your name and table number where you are seated', 'يرجى إدخال اسمك ورقم الطاولة التي تجلس عليها')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 rtl:mr-1 rtl:ml-0">
              {t('Your Name', 'اسمك')} *
            </label>
            <Input
              ref={nameInputRef}
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder={t('Enter your name', 'أدخل اسمك')}
              className="h-14 text-lg rounded-2xl border-slate-100 bg-slate-50 focus:bg-white transition-all font-bold px-5"
              required
              inputMode="text"
              autoComplete="name"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 rtl:mr-1 rtl:ml-0">
              {t('Table Number', 'رقم الطاولة')} *
            </label>
            <Input
              type="text"
              value={formTable}
              onChange={(e) => setFormTable(e.target.value)}
              placeholder={t('Enter table number', 'أدخل رقم الطاولة')}
              className="h-14 text-lg rounded-2xl border-slate-100 bg-slate-50 focus:bg-white transition-all font-bold px-5"
              inputMode="numeric"
              autoComplete="off"
              required
            />
            <p className="text-xs text-slate-500 mt-1 ml-1 rtl:mr-1 rtl:ml-0">
              {t('Please check the table number on your table', 'يرجى التحقق من رقم الطاولة على طاولتك')}
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={handleCancel}
              className="flex-1 h-14 rounded-2xl font-black text-slate-400"
            >
              {t('Cancel', 'إلغاء')}
            </Button>
            <Button
              type="submit"
              className="flex-1 h-14 rounded-2xl font-black bg-black text-white shadow-xl shadow-black/10 active:scale-[0.98] transition-all"
            >
              {t('Continue', 'متابعة')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
