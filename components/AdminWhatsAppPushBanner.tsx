'use client'

import { useState, useEffect } from 'react'
import { Bell, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getTenantPushSubscriptionToken } from '@/lib/tenant-push-subscribe'
import { isFirebaseConfigured } from '@/lib/firebase-config'

export function AdminWhatsAppPushBanner() {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    fetch('/api/admin/push-subscription', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setEnabled(d.enabled === true))
      .catch(() => setEnabled(false))
  }, [])

  const handleEnable = async () => {
    if (typeof window === 'undefined') return
    const isNativeCheck = typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform()
    if (!isNativeCheck && (!('serviceWorker' in navigator) || !('Notification' in window))) return
    if (!isFirebaseConfigured?.()) {
      alert('Push notifications are not configured for this app.')
      return
    }
    setLoading(true)
    try {
      const { token: fcmToken, permissionState } = await getTenantPushSubscriptionToken(true, '/dashboard/')
      if (permissionState !== 'granted') {
        alert('Enable notifications in your device settings to get alerts for new WhatsApp messages.')
        return
      }
      if (!fcmToken) throw new Error('Could not get token')
      const res = await fetch('/api/admin/push-subscription', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fcmToken }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error || 'Failed to save')
      }
      setEnabled(true)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to enable notifications')
    } finally {
      setLoading(false)
    }
  }

  if (enabled !== false || dismissed) return null

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3">
      <div className="flex items-center gap-3">
        <Bell className="size-5 text-amber-400 shrink-0" />
        <div>
          <p className="text-sm font-medium text-amber-200">Get notified when you receive new WhatsApp messages</p>
          <p className="text-xs text-slate-400 mt-0.5">Enable push to reply quickly from your phone</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={handleEnable}
          disabled={loading}
          className="bg-amber-600 text-slate-950 hover:bg-amber-500 shrink-0"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : 'Enable'}
        </Button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="p-1.5 rounded text-slate-500 hover:text-slate-300 transition-colors"
          aria-label="Dismiss"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  )
}
