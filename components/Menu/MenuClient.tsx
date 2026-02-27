'use client'

import MenuLayout from './MenuLayout'
import { InitialData } from '@/app/types/menu'

interface MenuClientProps {
  initialData: InitialData
  /** When rendering tenant menu at /t/[slug], pass slug so orders go to this tenant */
  tenantSlug?: string | null
  /** When customer opened menu via table QR (?table=N), lock Dine-in and pre-fill table number */
  initialTableNumber?: string | null
}

export default function MenuClient({ initialData, tenantSlug, initialTableNumber }: MenuClientProps) {
  return (
    <MenuLayout
      initialData={initialData}
      tenantSlug={tenantSlug ?? null}
      initialTableNumber={initialTableNumber ?? null}
    />
  )
}
