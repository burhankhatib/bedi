/**
 * Abort utilities for fetch requests.
 * When navigating away or aborting, fetch throws AbortError.
 * Use these to silently ignore aborts so no errors appear in console.
 */

/** True if the error is from an aborted request. */
export function isAbortError(err: unknown): boolean {
  if (err instanceof Error) return err.name === 'AbortError'
  return false
}

/** Wraps a fetch promise to silently swallow AbortError. Use for cleanup on unmount. */
export function fetchIgnoreAbort<T>(
  promise: Promise<T>,
  onAbort?: () => void
): Promise<T | undefined> {
  return promise.catch((err) => {
    if (isAbortError(err)) {
      onAbort?.()
      return undefined
    }
    throw err
  })
}
