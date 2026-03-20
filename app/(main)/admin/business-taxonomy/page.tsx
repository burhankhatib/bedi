import Link from 'next/link'
import { AdminBusinessTaxonomyClient } from './AdminBusinessTaxonomyClient'

export default function AdminBusinessTaxonomyPage() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Bulk import specialties:{' '}
        <Link href="/admin/seed-subcategories" className="text-amber-400 underline hover:text-amber-300">
          Seed subcategories
        </Link>
      </p>
      <AdminBusinessTaxonomyClient />
    </div>
  )
}
