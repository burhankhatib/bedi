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
import type { Polygon } from '@/lib/geofencing'
import { fetchWithTimeout } from '@/lib/fetchWithTimeout'
import { GEO_CITY_ALIASES } from '@/lib/registration-translations'

/** Nominatim can hang on slow mobile networks (especially Android). */
const REVERSE_GEOCODE_TIMEOUT_MS = 12_000

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
  /** Platform polygons for geofencing (from Sanity). Used by LocationModal. */
  polygons: Polygon[] | null
  /** Status of auto-detection; used by LocationGate to show the right screen. */
  locationStatus: LocationStatus
  /** When out_of_service, the detected city name for the apology message. */
  detectedCityName: string | null
  /** Retry geolocation (e.g. after user denied, or "Try again" on error). */
  retryAutoDetect: () => void
  /** User-gesture-triggered geolocation request (best chance to show iOS prompt). */
  requestLocationPermission: () => void
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
async function fetchCities(signal?: AbortSignal): Promise<string[]> {
  const res = await fetch('/api/home/cities', { signal })
  const data = await res.json()
  const cities = data?.cities ?? []
  return Array.isArray(cities) ? (cities as string[]) : []
}

/** GeoJSON feature from API. */
type PolygonFeature = {
  properties: { name: string }
  geometry: { coordinates: [number, number][][] }
}

function featuresToPolygons(features: PolygonFeature[]): Polygon[] {
  return features
    .filter((f) => f?.geometry?.coordinates?.[0]?.length >= 3)
    .map((f) => ({
      name: f.properties?.name ?? 'Unknown',
      coordinates: f.geometry.coordinates[0].map(([lng, lat]) => [lng, lat] as [number, number]),
    }))
}

export function LocationProvider({ children }: { children: ReactNode }) {
  const [city, setCity] = useState<string | null>(null)
  const [isChosen, setIsChosen] = useState(false)
  const [openLocationModal, setOpenLocationModal] = useState(false)
  const [availableCities, setAvailableCities] = useState<string[]>([])
  const [polygons, setPolygons] = useState<Polygon[] | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [citiesLoaded, setCitiesLoaded] = useState(false)
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('idle')
  const [detectedCityName, setDetectedCityName] = useState<string | null>(null)
  const [autoDetectTrigger, setAutoDetectTrigger] = useState(0)
  const hasTriedAutoDetect = useRef(false)
  const availableCitiesRef = useRef<string[]>([])
  const polygonsRef = useRef<Polygon[] | null>(null)
  const nominatimAbortRef = useRef<AbortController | null>(null)
  const reverseGeocodeSeqRef = useRef(0)
  const locationPermissionWatchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    availableCitiesRef.current = availableCities
  }, [availableCities])

  useEffect(() => {
    polygonsRef.current = polygons
  }, [polygons])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const savedCity = localStorage.getItem(STORAGE_CITY)
    const id = requestAnimationFrame(() => {
      if (savedCity && savedCity.trim()) {
        setCity(savedCity.trim())
        setIsChosen(true)
      }
      setIsInitialized(true)
    })
    return () => cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    if (!isInitialized) return
    if (city) {
      localStorage.setItem(STORAGE_CITY, city)
    }
  }, [isInitialized, city])

  useEffect(() => {
    const ac = new AbortController()
    ;(async () => {
      try {
        const c = await fetchCities(ac.signal)
        if (ac.signal.aborted) return
        setAvailableCities(c)
        setCitiesLoaded(true)
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return
        if (ac.signal.aborted) return
        setAvailableCities([])
        setCitiesLoaded(true)
      }
    })()
    return () => ac.abort()
  }, [])

  useEffect(() => {
    const ac = new AbortController()
    fetch('/api/geofencing/polygons', { signal: ac.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (ac.signal.aborted) return
        if (data?.features?.length) {
          setPolygons(featuresToPolygons(data.features))
        }
      })
      .catch((e) => {
        if (e instanceof DOMException && e.name === 'AbortError') return
      })
    return () => ac.abort()
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

  const resolveCoordinates = useCallback(async (latitude: number, longitude: number) => {
    const seq = ++reverseGeocodeSeqRef.current
    const cities = availableCitiesRef.current

    const polys = polygonsRef.current
    const geofenceCity = getCityFromCoordinates(longitude, latitude, polys ?? undefined)
    if (geofenceCity) {
      const match = cities.find((c) => c.toLowerCase() === geofenceCity.toLowerCase())
      if (match) {
        if (seq !== reverseGeocodeSeqRef.current) return
        setCity(match)
        setIsChosen(true)
        setLocationStatus('in_service')
        return
      }
    }

    nominatimAbortRef.current?.abort()
    const ac = new AbortController()
    nominatimAbortRef.current = ac
    let res: Response
    try {
      res = await fetchWithTimeout(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1`,
        { headers: { 'Accept-Language': 'en' }, signal: ac.signal },
        REVERSE_GEOCODE_TIMEOUT_MS
      )
    } catch (e) {
      if (seq !== reverseGeocodeSeqRef.current) return
      if (e instanceof DOMException && e.name === 'AbortError') {
        // Intentional cancel (new request or unmount) — ac is aborted; timeout uses merged signal only.
        if (ac.signal.aborted) return
        throw e
      }
      throw e
    }
    const data = await res.json()
    if (seq !== reverseGeocodeSeqRef.current) return
    if (ac.signal.aborted) return
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
        if (seq !== reverseGeocodeSeqRef.current) return
        setCity(match)
        setIsChosen(true)
        setLocationStatus('in_service')
        return
      }
    }

    if (seq !== reverseGeocodeSeqRef.current) return
    setDetectedCityName(geofenceCity || foundCity || null)
    setLocationStatus('out_of_service')
  }, [])

  const requestLocationPermission = useCallback(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setLocationStatus('error')
      return
    }

    if (locationPermissionWatchdogRef.current) {
      clearTimeout(locationPermissionWatchdogRef.current)
      locationPermissionWatchdogRef.current = null
    }

    setLocationStatus('detecting')
    // Android WebView / Chrome occasionally never fires geolocation callbacks; bail out to manual city pick.
    locationPermissionWatchdogRef.current = setTimeout(() => {
      locationPermissionWatchdogRef.current = null
      setLocationStatus((s) => (s === 'detecting' ? 'error' : s))
    }, 22_000)

    const clearWatchdog = () => {
      if (locationPermissionWatchdogRef.current) {
        clearTimeout(locationPermissionWatchdogRef.current)
        locationPermissionWatchdogRef.current = null
      }
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        clearWatchdog()
        try {
          await resolveCoordinates(position.coords.latitude, position.coords.longitude)
        } catch {
          setLocationStatus('error')
        }
      },
      (err) => {
        clearWatchdog()
        if (err.code === 1) setLocationStatus('denied')
        else setLocationStatus('error')
      },
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 0 }
    )
  }, [resolveCoordinates])

  // Auto-detect location on first visit when no saved city (skip modal when in service area).
  // Gated on citiesLoaded so the async callback never matches against an empty list.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!isInitialized || !citiesLoaded || city) return
    if (!navigator.geolocation) {
      const noGeoId = requestAnimationFrame(() => setLocationStatus('error'))
      return () => cancelAnimationFrame(noGeoId)
    }
    if (hasTriedAutoDetect.current) return
    hasTriedAutoDetect.current = true
    const detectingId = requestAnimationFrame(() => setLocationStatus('detecting'))
    let settled = false
    const forceTimeout = window.setTimeout(() => {
      if (settled) return
      settled = true
      // iOS Safari and some Android WebViews can stall geolocation without firing callbacks.
      setLocationStatus('error')
    }, 18_000)

    const onSuccess = async (position: GeolocationPosition) => {
      if (settled) return
      settled = true
      clearTimeout(forceTimeout)
      try {
        await resolveCoordinates(position.coords.latitude, position.coords.longitude)
      } catch {
        setLocationStatus('error')
      }
    }

    const onError = (err: GeolocationPositionError) => {
      if (settled) return
      settled = true
      clearTimeout(forceTimeout)
      if (err.code === 1) {
        setLocationStatus('denied')
      } else {
        setLocationStatus('error')
      }
    }

    navigator.geolocation.getCurrentPosition(onSuccess, onError, {
      enableHighAccuracy: false,
      timeout: 15_000,
      maximumAge: 0,
    })

    return () => {
      cancelAnimationFrame(detectingId)
      settled = true
      clearTimeout(forceTimeout)
    }
  }, [isInitialized, citiesLoaded, city, autoDetectTrigger, resolveCoordinates])

  const value: LocationContextValue = {
    city,
    isChosen,
    setLocation,
    clearLocation,
    openLocationModal,
    setOpenLocationModal,
    availableCities,
    polygons,
    locationStatus,
    detectedCityName,
    retryAutoDetect,
    requestLocationPermission,
  }

  useEffect(() => {
    return () => {
      nominatimAbortRef.current?.abort()
      if (locationPermissionWatchdogRef.current) {
        clearTimeout(locationPermissionWatchdogRef.current)
        locationPermissionWatchdogRef.current = null
      }
    }
  }, [])

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  )
}
