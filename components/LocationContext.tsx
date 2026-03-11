'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { getCityFromCoordinates } from '@/lib/geofencing'
import { GEO_CITY_ALIASES } from '@/lib/registration-translations'

const STORAGE_CITY = 'home_city'

export type LocationStatus =
  | 'idle'       // Not yet determined (e.g. no saved city, auto-detect not run)
  | 'detecting'  // Geolocation in progress
  | 'in_service' // User in service area or chose a city
  | 'out_of_service' // User's location is outside our service areas
  | 'denied'    // User denied geolocation
  | 'error'     // Geolocation/geocoding failed

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
  /** Status of auto-detection; used by LocationGate to show the right screen. */
  locationStatus: LocationStatus
  /** When out_of_service, the detected city name for the apology message. */
  detectedCityName: string | null
  /** Retry geolocation (e.g. after user denied, or "Try again" on error). */
  retryAutoDetect: () => void
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
  const [citiesLoaded, setCitiesLoaded] = useState(false)
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('idle')
  const [detectedCityName, setDetectedCityName] = useState<string | null>(null)
  const [autoDetectTrigger, setAutoDetectTrigger] = useState(0)
  const hasTriedAutoDetect = useRef(false)
  const availableCitiesRef = useRef<string[]>([])

  // Keep ref in sync so async callbacks always read the latest value
  availableCitiesRef.current = availableCities

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
    fetchCities().then((c) => {
      setAvailableCities(c)
      setCitiesLoaded(true)
    })
  }, [])

  const setLocation = useCallback((c: string) => {
    setCity(c?.trim() || null)
    setIsChosen(!!c?.trim())
    setOpenLocationModal(false)
    setLocationStatus('in_service')
  }, [])

  const clearLocation = useCallback(() => {
    setCity(null)
    setIsChosen(false)
    setLocationStatus('idle')
    setDetectedCityName(null)
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_CITY)
    }
  }, [])

  const retryAutoDetect = useCallback(() => {
    hasTriedAutoDetect.current = false
    setDetectedCityName(null)
    setLocationStatus('idle')
    setAutoDetectTrigger((t) => t + 1)
  }, [])

  // Auto-detect location on first visit when no saved city (skip modal when in service area).
  // Gated on citiesLoaded so the async callback never matches against an empty list.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!isInitialized || !citiesLoaded || city) return
    if (!navigator.geolocation) {
      setLocationStatus('error')
      return
    }
    if (hasTriedAutoDetect.current) return
    hasTriedAutoDetect.current = true
    setLocationStatus('detecting')

    const onSuccess = async (position: GeolocationPosition) => {
      try {
        const { latitude, longitude } = position.coords
        // Read from ref so we always get the latest cities, not a stale closure
        const cities = availableCitiesRef.current

        const geofenceCity = getCityFromCoordinates(longitude, latitude)
        if (geofenceCity) {
          const match = cities.find((c) => c.toLowerCase() === geofenceCity.toLowerCase())
          if (match) {
            setCity(match)
            setIsChosen(true)
            setLocationStatus('in_service')
            return
          }
        }

        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1`,
          { headers: { 'Accept-Language': 'en' } }
        )
        const data = await res.json()
        const address = data.address || {}
        const addressValues: string[] = [
          address.city,
          address.town,
          address.village,
          address.municipality,
          address.suburb,
          address.county,
          address.state,
        ].filter(Boolean)

        let foundCity = ''
        for (const val of addressValues) {
          const normalized = (val as string).toLowerCase().trim()
          if (GEO_CITY_ALIASES[normalized]) {
            foundCity = GEO_CITY_ALIASES[normalized]
            break
          }
        }
        if (!foundCity && addressValues.length > 0) {
          foundCity = addressValues[0] as string
        }

        if (foundCity) {
          const match = cities.find((c) => {
            const enMatch =
              c.toLowerCase() === foundCity.toLowerCase() ||
              foundCity.toLowerCase().includes(c.toLowerCase())
            return enMatch
          })
          if (match) {
            setCity(match)
            setIsChosen(true)
            setLocationStatus('in_service')
            return
          }
        }

        setDetectedCityName(geofenceCity || foundCity || null)
        setLocationStatus('out_of_service')
      } catch {
        setLocationStatus('error')
      }
    }

    const onError = (err: GeolocationPositionError) => {
      if (err.code === 1) {
        setLocationStatus('denied')
      } else {
        setLocationStatus('error')
      }
    }

    navigator.geolocation.getCurrentPosition(onSuccess, onError)
  }, [isInitialized, citiesLoaded, city, autoDetectTrigger])

  const value: LocationContextValue = {
    city,
    isChosen,
    setLocation,
    clearLocation,
    openLocationModal,
    setOpenLocationModal,
    availableCities,
    locationStatus,
    detectedCityName,
    retryAutoDetect,
  }

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  )
}
