'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

/**
 * Context for a stable DOM container used by Radix portals (Dialogs).
 * When provided, Dialogs render into this container instead of document.body,
 * avoiding the removeChild race during Next.js client-side navigation.
 */
const PortalContainerContext = createContext<HTMLElement | null>(null)

export function usePortalContainer(): HTMLElement | null {
  return useContext(PortalContainerContext)
}

export function PortalContainerProvider({ children }: { children: ReactNode }) {
  const [container, setContainer] = useState<HTMLElement | null>(null)
  const refCallback = useCallback((el: HTMLDivElement | null) => {
    if (el) setContainer(el)
  }, [])
  return (
    <PortalContainerContext.Provider value={container}>
      {/* Stable div in layout — portals render here during manage section navigation. High z-index so dialogs appear above maps, fixed layers, etc. */}
      <div ref={refCallback} data-portal-container className="relative z-[9999]" />
      {children}
    </PortalContainerContext.Provider>
  )
}
