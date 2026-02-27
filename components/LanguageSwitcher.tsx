'use client'

import { useLanguage } from './LanguageContext'
import { Button } from './ui/button'
import { Languages } from 'lucide-react'

export function LanguageSwitcher() {
  const { lang, setLang } = useLanguage()

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
      className="flex items-center gap-2 font-semibold"
    >
      <Languages className="h-4 w-4" />
      {lang === 'en' ? 'العربية' : 'English'}
    </Button>
  )
}
