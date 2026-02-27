import { ReactNode } from 'react'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/** Layout for /t/[slug] — ensures no caching for menu and nested routes. */
export default function TenantLayout({ children }: { children: ReactNode }) {
  return children
}
