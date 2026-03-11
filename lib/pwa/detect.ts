/**
 * PWA Engine – OS/Platform Detection
 * Pure utility functions, no React dependency.
 */

import type { OSInfo, InstallStep } from './types'

/** Detect current OS/platform. Safe to call on server (returns all false). */
export function detectOS(): OSInfo {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { isIOS: false, isAndroid: false, isDesktop: false, isStandalone: false }
  }
  const ua = navigator.userAgent
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: boolean }).MSStream
  const isAndroid = /Android/i.test(ua)
  const isDesktop = !/Android|iPhone|iPad|iPod|Mobile/i.test(ua)
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true

  return { isIOS, isAndroid, isDesktop, isStandalone }
}

/** Check if running in standalone (installed PWA) mode */
export function isStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

/** Get iOS "Add to Home Screen" instructions */
export function getIOSInstallSteps(lang: 'en' | 'ar'): InstallStep[] {
  if (lang === 'ar') {
    return [
      { number: 1, text: 'افتح هذه الصفحة في Safari.' },
      { number: 2, text: 'اضغط', icon: 'share' },
      { number: 3, text: 'اختر', icon: 'plus' },
      { number: 4, text: 'اضغط "إضافة"، ثم افتح التطبيق من الشاشة الرئيسية.' },
    ]
  }
  return [
    { number: 1, text: 'Open this page in Safari.' },
    { number: 2, text: 'Tap', icon: 'share' },
    { number: 3, text: 'Select', icon: 'plus' },
    { number: 4, text: 'Tap "Add", then open the app from your Home Screen.' },
  ]
}

/** Get text for the Share / Add to Home Screen labels */
export function getIOSLabels(lang: 'en' | 'ar') {
  return {
    share: lang === 'ar' ? 'مشاركة' : 'Share',
    addToHomeScreen: lang === 'ar' ? 'إضافة إلى الشاشة الرئيسية' : 'Add to Home Screen',
  }
}
