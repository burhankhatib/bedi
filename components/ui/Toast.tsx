'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, XCircle, AlertCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/components/LanguageContext'

export type ToastType = 'success' | 'error' | 'info'

interface ToastProps {
  message: string
  messageAr?: string
  type?: ToastType
  onClose: () => void
}

export function Toast({ message, messageAr, type = 'success', onClose }: ToastProps) {
  const { lang } = useLanguage()
  const displayMessage = lang === 'ar' && messageAr ? messageAr : message

  const icons = {
    success: CheckCircle2,
    error: XCircle,
    info: AlertCircle,
  }

  const colors = {
    success: {
      bg: 'bg-green-100',
      icon: 'text-green-600',
      border: 'border-green-200',
    },
    error: {
      bg: 'bg-red-100',
      icon: 'text-red-600',
      border: 'border-red-200',
    },
    info: {
      bg: 'bg-blue-100',
      icon: 'text-blue-600',
      border: 'border-blue-200',
    },
  }

  const Icon = icons[type]
  const colorScheme = colors[type]

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className="fixed top-20 left-1/2 -translate-x-1/2 z-[500] pointer-events-none"
    >
      <div className={`bg-white rounded-2xl shadow-2xl border-2 ${colorScheme.border} p-4 min-w-[320px] max-w-[90vw] pointer-events-auto`}>
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-full ${colorScheme.bg} flex items-center justify-center shrink-0`}>
            <Icon className={`w-6 h-6 ${colorScheme.icon}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className={`font-bold text-sm ${type === 'error' ? 'text-red-900' : type === 'info' ? 'text-blue-900' : 'text-slate-900'}`}>
              {displayMessage}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 rounded-full shrink-0 hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  )
}
