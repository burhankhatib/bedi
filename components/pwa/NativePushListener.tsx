'use client'

import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/ToastProvider'

export function NativePushListener() {
  const router = useRouter()
  const { showToast } = useToast()

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    let listenersSetup = false
    
    const setupListeners = async () => {
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications')
        
        // Handle notifications received in the foreground
        await PushNotifications.addListener('pushNotificationReceived', (notification) => {
          console.log('Push notification received: ', notification)
          showToast(`${notification.title ? notification.title + ' - ' : ''}${notification.body}`, undefined, 'info')
        })

        // Handle taps on notifications (both background and foreground)
        await PushNotifications.addListener('pushNotificationActionPerformed', (notificationAction) => {
          console.log('Push notification action performed', notificationAction)
          const data = notificationAction.notification.data
          if (data && data.url) {
            try {
              // Normalize URL so we stay in-app for same-origin links
              // If it's a full URL string (e.g. https://bedi.delivery/driver)
              if (data.url.startsWith('http')) {
                const targetUrl = new URL(data.url)
                const currentUrl = new URL(window.location.href)
                
                const targetHost = targetUrl.hostname.replace(/^www\./, '')
                const currentHost = currentUrl.hostname.replace(/^www\./, '')
                
                // Same origin or our domain -> push path+search
                if (targetHost === currentHost || targetHost === 'bedi.delivery') {
                  router.push(targetUrl.pathname + targetUrl.search)
                } else {
                  // External link (should be rare) -> force full load or native open
                  window.location.href = data.url
                }
              } else {
                // Already relative
                router.push(data.url)
              }
            } catch (e) {
              console.error('Failed to parse push data URL', e)
              router.push(data.url) // Fallback
            }
          }
        })
        
        listenersSetup = true
      } catch (err) {
        console.error('Failed to setup native push listeners:', err)
      }
    }
    
    setupListeners()

    return () => {
      if (listenersSetup) {
        import('@capacitor/push-notifications').then(({ PushNotifications }) => {
          PushNotifications.removeAllListeners().catch(console.error)
        }).catch(console.error)
      }
    }
  }, [router, showToast])

  return null
}

