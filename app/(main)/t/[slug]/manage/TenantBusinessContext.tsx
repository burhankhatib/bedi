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
  const mountedRef = useRef(false)
  const refetchAbortRef = useRef<AbortController | null>(null)
  const initialAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      refetchAbortRef.current?.abort()
      initialAbortRef.current?.abort()
    }
  }, [])

  const refetch = useCallback(async () => {
    if (!slug) return
    refetchAbortRef.current?.abort()
    const ac = new AbortController()
    refetchAbortRef.current = ac
    if (mountedRef.current) setLoading(true)
    try {
      const res = await fetch(`/api/tenants/${encodeURIComponent(slug)}/business`, {
        credentials: 'include',
        cache: 'no-store',
        signal: ac.signal,
      })
      if (res.ok) {
        const d = await res.json()
        if (mountedRef.current && !ac.signal.aborted) setData(d)
      }
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return
      // ignore
    } finally {
      if (mountedRef.current && !ac.signal.aborted) setLoading(false)
    }
  }, [slug])

  useEffect(() => {
    if (!slug) return
    if (fetchedSlugRef.current === slug) return
    fetchedSlugRef.current = slug
    setData(null)
    setLoading(true)
    initialAbortRef.current?.abort()
    const ac = new AbortController()
    initialAbortRef.current = ac
    const timeout = setTimeout(() => {
      if (mountedRef.current && !ac.signal.aborted) setLoading(false)
    }, 8000)
    fetch(`/api/tenants/${encodeURIComponent(slug)}/business`, {
      credentials: 'include',
      cache: 'no-store',
      signal: ac.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (mountedRef.current && !ac.signal.aborted) setData(d ?? null)
      })
      .catch((err) => {
        if ((err as Error)?.name === 'AbortError') return
        if (mountedRef.current) setData(null)
      })
      .finally(() => {
        if (mountedRef.current && !ac.signal.aborted) {
          clearTimeout(timeout)
          setLoading(false)
        }
      })
    return () => {
      ac.abort()
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
