'use client'

import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react'

/**
 * Context for a stable DOM container used by Radix portals (Dialogs, Sheets).
 * Uses a body-mounted div that NEVER unmounts during Next.js client-side navigation,
 * avoiding the removeChild race that causes page freeze and TypeError.
 */
const PortalContainerContext = createContext<HTMLElement | null>(null)

export function usePortalContainer(): HTMLElement | null {
  return useContext(PortalContainerContext)
}

const PORTAL_ROOT_ID = 'zonify-portal-root'

export function PortalContainerProvider({ children }: { children: ReactNode }) {
  const [container, setContainer] = useState<HTMLElement | null>(null)
  const mountedRef = useRef(false)

  useEffect(() => {
    if (typeof document === 'undefined') return
    let el = document.getElementById(PORTAL_ROOT_ID)
    if (!el) {
      el = document.createElement('div')
      el.id = PORTAL_ROOT_ID
      el.setAttribute('data-portal-container', '')
      el.style.cssText = 'position:relative;z-index:99999;'
      document.body.appendChild(el)
    }
    mountedRef.current = true
    setContainer(el)
    return () => {
      mountedRef.current = false
      // Never remove the portal root during app lifetime — avoids removeChild race
    }
  }, [])

  return (
    <PortalContainerContext.Provider value={container}>
      {children}
    </PortalContainerContext.Provider>
  )
}
