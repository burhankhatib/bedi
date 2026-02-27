'use client'

import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Toast, ToastType } from './Toast'

interface ToastMessage {
  id: string
  message: string
  messageAr?: string
  type: ToastType
}

interface ToastContextType {
  showToast: (message: string, messageAr?: string, type?: ToastType) => void
  hideToast: () => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastMessage | null>(null)

  const showToast = useCallback((message: string, messageAr?: string, type: ToastType = 'success') => {
    const id = Date.now().toString()
    setToast({ id, message, messageAr, type })
  }, [])

  const hideToast = useCallback(() => {
    setToast(null)
  }, [])

  // Auto-hide toast after 5 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        hideToast()
      }, 5000)

      return () => clearTimeout(timer)
    }
  }, [toast, hideToast])

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      <AnimatePresence>
        {toast && (
          <Toast
            key={toast.id}
            message={toast.message}
            messageAr={toast.messageAr}
            type={toast.type}
            onClose={hideToast}
          />
        )}
      </AnimatePresence>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return context
}
