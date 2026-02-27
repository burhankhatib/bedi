import { redirect } from 'next/navigation'

/**
 * Tenant-scoped verify-phone: redirect to global verify-phone with returnTo so user comes back to this tenant's menu.
 */
export default async function TenantVerifyPhonePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const returnTo = `/t/${slug}`
  redirect('/verify-phone?returnTo=' + encodeURIComponent(returnTo))
}
