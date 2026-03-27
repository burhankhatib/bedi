import { Capacitor } from '@capacitor/core'

export type DeviceGeolocationCoords = {
  latitude: number
  longitude: number
  accuracy?: number | null
}

/** Same meaning as GeolocationPositionError.PERMISSION_DENIED */
export const GEO_PERMISSION_DENIED = 1

export function isDeviceGeolocationSupported(): boolean {
  if (typeof window === 'undefined') return false
  if (Capacitor.isNativePlatform()) return true
  return typeof navigator !== 'undefined' && !!navigator.geolocation
}

function isPermissionDeniedError(e: unknown): boolean {
  if (typeof e !== 'object' || e === null) return false
  if ('code' in e && (e as { code: unknown }).code === GEO_PERMISSION_DENIED) return true
  const msg = e instanceof Error ? e.message : String(e)
  return /denied|permission/i.test(msg)
}

/**
 * One-shot device position: uses **@capacitor/geolocation** in Capacitor native shells,
 * otherwise `navigator.geolocation` (browser / PWA).
 */
export async function getDeviceGeolocationPosition(options?: {
  enableHighAccuracy?: boolean
  timeout?: number
  maximumAge?: number
}): Promise<DeviceGeolocationCoords> {
  const enableHighAccuracy = options?.enableHighAccuracy ?? false
  const timeout = options?.timeout ?? 15_000
  const maximumAge = options?.maximumAge ?? 0

  if (Capacitor.isNativePlatform()) {
    try {
      const { Geolocation } = await import('@capacitor/geolocation')
      let perm = await Geolocation.checkPermissions()
      if (perm.location !== 'granted') {
        perm = await Geolocation.requestPermissions()
      }
      if (perm.location !== 'granted') {
        throw Object.assign(new Error('Geolocation permission denied'), {
          code: GEO_PERMISSION_DENIED,
        })
      }
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy,
        timeout,
        maximumAge,
      })
      if (pos.coords.latitude === 0 && pos.coords.longitude === 0) {
        console.warn('Geolocation returned exactly 0,0 - this is often an emulator without mock location set.')
      }
      return {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      }
    } catch (e) {
      if (isPermissionDeniedError(e)) {
        throw Object.assign(new Error('Geolocation permission denied'), {
          code: GEO_PERMISSION_DENIED,
        })
      }
      throw e
    }
  }

  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    throw new Error('Geolocation is not available')
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (p) => {
        if (p.coords.latitude === 0 && p.coords.longitude === 0) {
          console.warn('Geolocation returned exactly 0,0 - this is often an emulator without mock location set.')
        }
        resolve({
          latitude: p.coords.latitude,
          longitude: p.coords.longitude,
          accuracy: p.coords.accuracy,
        })
      },
      reject,
      { enableHighAccuracy, timeout, maximumAge }
    )
  })
}

export function isGeolocationUserDenied(e: unknown): boolean {
  if (typeof e === 'object' && e !== null && 'code' in e) {
    const c = (e as { code: unknown }).code
    if (c === GEO_PERMISSION_DENIED || c === 1) return true
  }
  return isPermissionDeniedError(e)
}

export type WatchGeolocationId = string | number

export async function watchDeviceGeolocation(
  onSuccess: (coords: DeviceGeolocationCoords) => void,
  onError: (error: unknown) => void,
  options?: {
    enableHighAccuracy?: boolean
    timeout?: number
    maximumAge?: number
  }
): Promise<WatchGeolocationId> {
  const enableHighAccuracy = options?.enableHighAccuracy ?? false
  const timeout = options?.timeout ?? 15_000
  const maximumAge = options?.maximumAge ?? 0

  if (Capacitor.isNativePlatform()) {
    try {
      const { Geolocation } = await import('@capacitor/geolocation')
      let perm = await Geolocation.checkPermissions()
      if (perm.location !== 'granted') {
        perm = await Geolocation.requestPermissions()
      }
      if (perm.location !== 'granted') {
        const err = Object.assign(new Error('Geolocation permission denied'), { code: GEO_PERMISSION_DENIED })
        onError(err)
        throw err
      }
      return await Geolocation.watchPosition(
        { enableHighAccuracy, timeout, maximumAge },
        (pos, err) => {
          if (err) {
            if (isPermissionDeniedError(err)) {
              onError(Object.assign(new Error('Geolocation permission denied'), { code: GEO_PERMISSION_DENIED }))
            } else {
              onError(err)
            }
            return
          }
          if (pos) {
            if (pos.coords.latitude === 0 && pos.coords.longitude === 0) {
              console.warn('Geolocation returned exactly 0,0 - this is often an emulator without mock location set.')
            }
            onSuccess({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
            })
          }
        }
      )
    } catch (e) {
      if (isPermissionDeniedError(e)) {
        const err = Object.assign(new Error('Geolocation permission denied'), { code: GEO_PERMISSION_DENIED })
        onError(err)
        throw err
      }
      onError(e)
      throw e
    }
  }

  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    const err = new Error('Geolocation is not available')
    onError(err)
    throw err
  }

  return navigator.geolocation.watchPosition(
    (p) => {
      if (p.coords.latitude === 0 && p.coords.longitude === 0) {
        console.warn('Geolocation returned exactly 0,0 - this is often an emulator without mock location set.')
      }
      onSuccess({
        latitude: p.coords.latitude,
        longitude: p.coords.longitude,
        accuracy: p.coords.accuracy,
      })
    },
    (e) => {
      onError(e)
    },
    { enableHighAccuracy, timeout, maximumAge }
  )
}

export async function clearDeviceGeolocationWatch(watchId: WatchGeolocationId): Promise<void> {
  if (typeof watchId === 'string') {
    if (Capacitor.isNativePlatform()) {
      try {
        const { Geolocation } = await import('@capacitor/geolocation')
        await Geolocation.clearWatch({ id: watchId })
      } catch (e) {
        console.warn('Failed to clear native geolocation watch:', e)
      }
    }
  } else if (typeof watchId === 'number') {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId)
    }
  }
}

export async function checkDeviceGeolocationPermission(): Promise<'granted' | 'denied' | 'prompt'> {
  if (Capacitor.isNativePlatform()) {
    try {
      const { Geolocation } = await import('@capacitor/geolocation')
      const perm = await Geolocation.checkPermissions()
      return perm.location === 'granted' ? 'granted' : perm.location === 'denied' ? 'denied' : 'prompt'
    } catch {
      return 'prompt'
    }
  }
  
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return 'denied'
  }
  
  try {
    const perms = (navigator as any).permissions
    if (perms?.query) {
      const result = await perms.query({ name: 'geolocation' })
      return result.state as 'granted' | 'denied' | 'prompt'
    }
  } catch {
    // ignore
  }
  return 'prompt'
}
