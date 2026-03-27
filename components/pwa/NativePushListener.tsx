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
            router.push(data.url)
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

