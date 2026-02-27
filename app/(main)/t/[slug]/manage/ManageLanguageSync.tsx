'use client'

import { useEffect } from 'react'
import { useLanguage } from '@/components/LanguageContext'
import { useTenantBusiness } from './TenantBusinessContext'

/**
 * Syncs the manage UI language with the tenant's default language.
 * Uses TenantBusinessContext so we don't duplicate GET /api/tenants/[slug]/business.
 */
export function ManageLanguageSync({ slug }: { slug: string }) {
  const { setLang } = useLanguage()
  const { data } = useTenantBusiness()

  useEffect(() => {
    const lang = data?.tenant?.defaultLanguage
    if (lang === 'ar' || lang === 'en') {
      setLang(lang)
    }
  }, [data?.tenant?.defaultLanguage, setLang])

  return null
}
