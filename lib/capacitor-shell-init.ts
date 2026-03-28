import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'
import { SystemBars, SystemBarsStyle } from '@capacitor/core'

export async function initCapacitorShell() {
  if (!Capacitor.isNativePlatform()) return

  try {
    // In Capacitor 8, SystemBars is the modern edge-to-edge API
    await SystemBars.setStyle({ style: SystemBarsStyle.Dark })
  } catch (e) {
    console.warn('SystemBars setStyle failed', e)
  }

  try {
    // Fallback/coordination for older Android or iOS specific cases
    await StatusBar.setStyle({ style: Style.Dark })
  } catch (e) {
    console.warn('StatusBar setStyle failed', e)
  }
}
