/**
 * Fetch with a hard timeout. Important on Android Chrome where fetch to slow
 * endpoints can otherwise hang indefinitely without rejecting.
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(input, {
      ...init,
      signal: init?.signal
        ? anySignal(init.signal, controller.signal)
        : controller.signal,
    })
  } finally {
    clearTimeout(id)
  }
}

function anySignal(a: AbortSignal, b: AbortSignal): AbortSignal {
  if (typeof AbortSignal !== 'undefined' && 'any' in AbortSignal && typeof AbortSignal.any === 'function') {
    return AbortSignal.any([a, b])
  }
  const combined = new AbortController()
  const forward = () => {
    if (!combined.signal.aborted) combined.abort()
  }
  if (a.aborted || b.aborted) {
    forward()
    return combined.signal
  }
  a.addEventListener('abort', forward, { once: true })
  b.addEventListener('abort', forward, { once: true })
  return combined.signal
}
