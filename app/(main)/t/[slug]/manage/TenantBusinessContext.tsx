'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

export type TenantBusinessData = {
  tenant?: {
    _id: string
    name: string
    country?: string
    city?: string
    businessType?: string
    businessSubcategoryIds?: string[]
    deactivated?: boolean
    deactivateUntil?: string | null
    defaultLanguage?: string | null
    supportsDineIn?: boolean
    supportsReceiveInPerson?: boolean
  }
  restaurantInfo?: Record<string, unknown> | null
}

type TenantBusinessContextValue = {
  data: TenantBusinessData | null
  loading: boolean
  refetch: () => Promise<void>
}

const TenantBusinessContext = createContext<TenantBusinessContextValue | null>(null)

export function useTenantBusiness(): TenantBusinessContextValue {
  const ctx = useContext(TenantBusinessContext)
  if (!ctx) {
    return {
      data: null,
      loading: false,
      refetch: async () => {},
    }
  }
  return ctx
}

export function TenantBusinessProvider({ slug, children }: { slug: string; children: ReactNode }) {
  const [data, setData] = useState<TenantBusinessData | null>(null)
  const [loading, setLoading] = useState(true)
  const fetchedSlugRef = useRef<string | null>(null)

  const refetch = useCallback(async () => {
    if (!slug) return
    try {
      const res = await fetch(`/api/tenants/${encodeURIComponent(slug)}/business`, { credentials: 'include', cache: 'no-store' })
      if (res.ok) {
        const d = await res.json()
        setData(d)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => {
    if (!slug) return
    if (fetchedSlugRef.current === slug) return
    fetchedSlugRef.current = slug
    setData(null)
    setLoading(true)
    let cancelled = false
    const timeout = setTimeout(() => {
      if (!cancelled) setLoading(false)
    }, 8000)
    fetch(`/api/tenants/${encodeURIComponent(slug)}/business`, { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled) setData(d ?? null)
      })
      .catch(() => {
        if (!cancelled) setData(null)
      })
      .finally(() => {
        if (!cancelled) {
          clearTimeout(timeout)
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [slug])

  const value: TenantBusinessContextValue = {
    data,
    loading,
    refetch,
  }

  return (
    <TenantBusinessContext.Provider value={value}>
      {children}
    </TenantBusinessContext.Provider>
  )
}
