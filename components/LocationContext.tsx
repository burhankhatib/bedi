'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

const STORAGE_CITY = 'home_city'

export type LocationState = {
  city: string | null
  isChosen: boolean
}

type LocationContextValue = LocationState & {
  setLocation: (city: string) => void
  clearLocation: () => void
  openLocationModal: boolean
  setOpenLocationModal: (open: boolean) => void
  availableCities: string[]
}

const LocationContext = createContext<LocationContextValue | null>(null)

export function useLocation() {
  const ctx = useContext(LocationContext)
  if (!ctx) {
    throw new Error('useLocation must be used within LocationProvider')
  }
  return ctx
}

/** Fetches cities that have at least one business (from tenants). */
async function fetchCities(): Promise<string[]> {
  try {
    const res = await fetch('/api/home/cities')
    const data = await res.json()
    const cities = data?.cities ?? []
    return Array.isArray(cities) ? (cities as string[]) : []
  } catch {
    return []
  }
}

export function LocationProvider({ children }: { children: ReactNode }) {
  const [city, setCity] = useState<string | null>(null)
  const [isChosen, setIsChosen] = useState(false)
  const [openLocationModal, setOpenLocationModal] = useState(false)
  const [availableCities, setAvailableCities] = useState<string[]>([])
  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const savedCity = localStorage.getItem(STORAGE_CITY)
    if (savedCity && savedCity.trim()) {
      setCity(savedCity.trim())
      setIsChosen(true)
    }
    setIsInitialized(true)
  }, [])

  useEffect(() => {
    if (!isInitialized) return
    if (city) {
      localStorage.setItem(STORAGE_CITY, city)
    }
  }, [isInitialized, city])

  useEffect(() => {
    fetchCities().then(setAvailableCities)
  }, [])

  const setLocation = useCallback((c: string) => {
    setCity(c?.trim() || null)
    setIsChosen(!!c?.trim())
    setOpenLocationModal(false)
  }, [])

  const clearLocation = useCallback(() => {
    setCity(null)
    setIsChosen(false)
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_CITY)
    }
  }, [])

  const value: LocationContextValue = {
    city,
    isChosen,
    setLocation,
    clearLocation,
    openLocationModal,
    setOpenLocationModal,
    availableCities,
  }

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  )
}
