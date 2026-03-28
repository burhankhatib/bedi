import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'

export async function hapticImpact(style: 'light' | 'medium' | 'heavy' = 'medium') {
  if (!Capacitor.isNativePlatform()) return
  try {
    const impactStyle = 
      style === 'light' ? ImpactStyle.Light : 
      style === 'heavy' ? ImpactStyle.Heavy : ImpactStyle.Medium
    await Haptics.impact({ style: impactStyle })
  } catch (e) {
    // ignore
  }
}

export async function hapticNotification(type: 'success' | 'warning' | 'error' = 'success') {
  if (!Capacitor.isNativePlatform()) return
  try {
    const notificationType = 
      type === 'warning' ? NotificationType.Warning :
      type === 'error' ? NotificationType.Error : NotificationType.Success
    await Haptics.notification({ type: notificationType })
  } catch (e) {
    // ignore
  }
}

export async function hapticSelectionStart() {
  if (!Capacitor.isNativePlatform()) return
  try { await Haptics.selectionStart() } catch (e) {}
}

export async function hapticSelectionChanged() {
  if (!Capacitor.isNativePlatform()) return
  try { await Haptics.selectionChanged() } catch (e) {}
}

export async function hapticSelectionEnd() {
  if (!Capacitor.isNativePlatform()) return
  try { await Haptics.selectionEnd() } catch (e) {}
}
