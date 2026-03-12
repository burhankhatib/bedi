'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'

type Language = 'en' | 'ar'

interface LanguageContextType {
  lang: Language
  setLang: (lang: Language) => void
  t: (en: string, ar: string) => string
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // Arabic default; selection persisted in localStorage so it survives refresh
  const [lang, setLang] = useState<Language>('ar')
  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('language') as Language
    if (saved === 'en' || saved === 'ar') setLang(saved)
    setIsInitialized(true)
  }, [])

  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem('language', lang)
      document.documentElement.lang = lang
      document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
    }
  }, [lang, isInitialized])

  const t = (en: string, ar: string) => (lang === 'ar' ? ar : en)

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      <div style={{ opacity: isInitialized ? 1 : 0, transition: 'opacity 0.2s' }}>
        {children}
      </div>
    </LanguageContext.Provider>
  )
}

const defaultContext: LanguageContextType = {
  lang: 'ar',
  setLang: () => {},
  t: (en: string, ar: string) => en,
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  return context ?? defaultContext
}
