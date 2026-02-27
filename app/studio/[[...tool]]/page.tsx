/**
 * Sanity Studio (catch-all). Do not import from next-sanity/studio here —
 * that can trigger "immutable" TypeError under Turbopack. Use Webpack for dev (npm run dev).
 */

import type { Metadata, Viewport } from 'next'
import { StudioLoader } from '../StudioLoader'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Sanity Studio',
  description: 'Content management',
  robots: { index: false, follow: false },
  referrer: 'same-origin',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function StudioPage() {
  return <StudioLoader />
}
