import { TrackOrderEntryClient } from './TrackOrderEntryClient'
import { getTenantIdBySlug } from '@/lib/tenant'
import { notFound } from 'next/navigation'

export default async function TrackOrderEntryPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  if (!slug?.trim()) notFound()

  const tenantId = await getTenantIdBySlug(slug)
  if (!tenantId) notFound()

  return (
    <main className="min-h-screen bg-slate-100">
      <TrackOrderEntryClient slug={slug} />
    </main>
  )
}
