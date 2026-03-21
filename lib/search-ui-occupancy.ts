'use client'

import { useEffect } from 'react'

/** Fired when any customer UniversalSearch has dropdown open or AI session active (hide ChatFab, etc.). */
export const SEARCH_UI_OCCUPIED_EVENT = 'bedi-search-ui-occupied'

let occupiedRefCount = 0

/** Ref-counted: multiple mounted search inputs can be “open”; FAB hides if any is busy. */
export function useReportSearchUiOccupied(occupied: boolean) {
  useEffect(() => {
    if (!occupied) return
    occupiedRefCount += 1
    if (occupiedRefCount === 1) {
      window.dispatchEvent(
        new CustomEvent(SEARCH_UI_OCCUPIED_EVENT, { detail: { occupied: true } })
      )
    }
    return () => {
      occupiedRefCount = Math.max(0, occupiedRefCount - 1)
      if (occupiedRefCount === 0) {
        window.dispatchEvent(
          new CustomEvent(SEARCH_UI_OCCUPIED_EVENT, { detail: { occupied: false } })
        )
      }
    }
  }, [occupied])
}
