import { redirect } from 'next/navigation'
import { checkTenantAuth } from '@/lib/tenant-auth'
import { requirePermission } from '@/lib/staff-permissions'
import { client } from '@/sanity/lib/client'
import Link from 'next/link'
import { MenuManageClient } from './MenuManageClient'

export default async function ManageMenuPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const authResult = await checkTenantAuth(slug)
  if (!authResult.ok) redirect('/dashboard')
  if (!requirePermission(authResult, 'settings_menu')) redirect(`/t/${slug}/manage`)

  const [categories, products] = await Promise.all([
    client.fetch<Array<{ _id: string; title_en: string; title_ar: string; slug: string; sortOrder?: number }>>(
      `*[_type == "category" && site._ref == $siteId] | order(sortOrder asc) { _id, title_en, title_ar, "slug": slug.current, sortOrder }`,
      { siteId: authResult.tenantId }
    ),
    client.fetch<
      Array<{
        _id: string
        title_en: string
        title_ar: string
        description_en?: string
        description_ar?: string
        ingredients_en?: string[]
        ingredients_ar?: string[]
        price: number
        specialPrice?: number
        specialPriceExpires?: string
        currency: string
        categoryRef: string
        sortOrder?: number
        isPopular?: boolean
        isAvailable?: boolean
        availableAgainAt?: string
        dietaryTags?: string[]
        addOns?: Array<{ name_en: string; name_ar: string; price: number }>
      }>
    >(
      `*[_type == "product" && site._ref == $siteId] | order(sortOrder asc) {
        _id, title_en, title_ar, description_en, description_ar,
        ingredients_en, ingredients_ar, price, specialPrice, specialPriceExpires, currency,
        "categoryRef": category._ref, sortOrder, isPopular, isAvailable, availableAgainAt,
        dietaryTags, addOns
      }`,
      { siteId: authResult.tenantId }
    ),
  ])

  return (
    <div>
      <h1 className="text-xl font-bold">Menu</h1>
      <p className="mt-1 text-slate-400">Categories and products for your menu. Add or edit below.</p>
      <MenuManageClient
        slug={slug}
        initialCategories={categories || []}
        initialProducts={(products || []).map((p) => ({ ...p, categoryId: p.categoryRef }))}
      />
    </div>
  )
}
