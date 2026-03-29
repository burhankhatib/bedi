'use client'

import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_HOME_FILTERS, type HomePageFilters } from '@/components/home/QuickFiltersRow'
import {
  HOME_FILTERS_STORAGE_KEY,
  parseStoredHomeFilters,
  persistHomeFilters,
} from '@/lib/home-filters-storage'

export function usePersistedHomeFilters() {
  const [filters, setFiltersState] = useState<HomePageFilters>(DEFAULT_HOME_FILTERS)

  useEffect(() => {
    const raw = localStorage.getItem(HOME_FILTERS_STORAGE_KEY)
    setFiltersState(parseStoredHomeFilters(raw))
  }, [])

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== HOME_FILTERS_STORAGE_KEY || e.newValue == null) return
      setFiltersState(parseStoredHomeFilters(e.newValue))
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const setFilters = useCallback(
    (next: HomePageFilters | ((prev: HomePageFilters) => HomePageFilters)) => {
      setFiltersState((prev) => {
        const resolved = typeof next === 'function' ? (next as (p: HomePageFilters) => HomePageFilters)(prev) : next
        persistHomeFilters(resolved)
        return resolved
      })
    },
    []
  )

  return { filters, setFilters }
}
