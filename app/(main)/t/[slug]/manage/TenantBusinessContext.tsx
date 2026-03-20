'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { isAbortError } from '@/lib/abort-utils'

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
    supportsDelivery?: boolean
    freeDeliveryEnabled?: boolean
    supportsDriverPickup?: boolean
    catalogHidePrices?: boolean
    prioritizeWhatsapp?: boolean
    ownerPhone?: string
    locationLat?: number
    locationLng?: number
  }
  restaurantInfo?: Record<string, unknown> | null
}

type TenantBusinessContextValue = {
  data: TenantBusinessData | null
  loading: boolean
  refetch: (forceRefresh?: boolean) => Promise<void>
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

export function TenantBusinessProvider({ slug, children, initialData }: { slug: string; children: ReactNode; initialData?: TenantBusinessData }) {
  const [data, setData] = useState<TenantBusinessData | null>(initialData ?? null)
  const [loading, setLoading] = useState(!initialData)
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

  const refetch = useCallback(async (forceRefresh = false) => {
    if (!slug) return
    refetchAbortRef.current?.abort()
    const ac = new AbortController()
    refetchAbortRef.current = ac
    if (mountedRef.current) setLoading(true)
    try {
      const url = `/api/tenants/${encodeURIComponent(slug)}/business${forceRefresh ? '?refresh=1' : ''}`
      const res = await fetch(url, {
        credentials: 'include',
        cache: forceRefresh ? 'no-store' : 'default',
        signal: ac.signal,
      })
      if (res.ok) {
        const d = await res.json()
        if (mountedRef.current && !ac.signal.aborted) setData(d)
      }
    } catch (err) {
      if (isAbortError(err)) return
    } finally {
      if (mountedRef.current && !ac.signal.aborted) setLoading(false)
    }
  }, [slug])

  useEffect(() => {
    if (!slug) return
    if (fetchedSlugRef.current === slug) return
    fetchedSlugRef.current = slug

    if (initialData) {
      setData(initialData)
      setLoading(false)
      return
    }

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
        if (isAbortError(err)) return
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
