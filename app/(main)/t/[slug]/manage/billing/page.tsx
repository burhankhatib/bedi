import { redirect } from 'next/navigation'
import { checkTenantAuth } from '@/lib/tenant-auth'
import { requirePermission } from '@/lib/staff-permissions'
import { getTenantBySlug } from '@/lib/tenant'
import { isPayPalOrdersEnabled } from '@/lib/paypal-server'
import { isBOPConfigured } from '@/lib/bop-payments'
import { BillingManageClient } from './BillingManageClient'

/** When true, PayPal is hidden (BOP is the main payment method). Set to false to show both. */
const HIDE_PAYPAL = process.env.HIDE_PAYPAL_BILLING_OPTION !== 'false'

export default async function ManageBillingPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const auth = await checkTenantAuth(slug)
  if (!auth.ok) redirect('/dashboard')
  if (!requirePermission(auth, 'billing')) redirect(`/t/${slug}/manage`)

  const tenant = await getTenantBySlug(slug, { useCdn: false })
  const subscriptionExpiresAt = tenant?.subscriptionExpiresAt ?? null
  const subscriptionLastPaymentAt = tenant?.subscriptionLastPaymentAt ?? null
  const subscriptionStatus = tenant?.subscriptionStatus ?? 'trial'
  const paypalSubscriptionId = tenant?.paypalSubscriptionId ?? null
  const useOrdersApi = isPayPalOrdersEnabled()
  const subscriptionPlanId =
    process.env.NEXT_PUBLIC_PAYPAL_SUBSCRIPTION_PLAN_ID?.trim() ?? ''
  const useBOP = isBOPConfigured()
  const hidePayPal = useBOP && HIDE_PAYPAL // Hide PayPal when BOP is primary (set HIDE_PAYPAL_BILLING_OPTION=false to show both)

  return (
    <BillingManageClient
      slug={slug}
      subscriptionExpiresAt={subscriptionExpiresAt}
      subscriptionLastPaymentAt={subscriptionLastPaymentAt}
      subscriptionStatus={subscriptionStatus}
      paypalSubscriptionId={paypalSubscriptionId}
      useOrdersApi={useOrdersApi}
      subscriptionPlanId={subscriptionPlanId}
      useBOP={useBOP}
      hidePayPal={hidePayPal}
    />
  )
}
