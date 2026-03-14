'use client'

import { PushStatusCard } from './PushStatusCard'
import { useCustomerTrackPush } from '@/app/(main)/t/[slug]/track/[token]/useCustomerTrackPush'
import { getCustomerPWAConfig } from '@/lib/pwa/configs'

export function CustomerTrackPushStatusCard({ slug, token }: { slug: string; token: string }) {
  const { hasPush, checked, loading, permission, needsIOSHomeScreen, doSubscribe, refreshToken } = useCustomerTrackPush(slug, token)
  const status = !checked ? 'checking' : hasPush ? 'connected' : permission === 'denied' ? 'denied' : 'disconnected'
  return (
    <PushStatusCard
      variant="customer-track"
      slug={slug}
      status={status}
      loading={loading}
      isDenied={permission === 'denied'}
      needsIOSHomeScreen={needsIOSHomeScreen}
      onSubscribe={() => doSubscribe()}
      onRefresh={() => refreshToken()}
      pwaConfig={getCustomerPWAConfig()}
      theme="light"
    />
  )
}
