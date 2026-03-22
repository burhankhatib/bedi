// Placeholder for future analytics instrumentation.
export function trackRatingEvent(eventName: string, properties: Record<string, unknown>) {
  // e.g. mixpanel.track(eventName, properties) or amplitude.track
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Telemetry] ${eventName}`, properties)
  }
}
