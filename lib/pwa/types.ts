/**
 * PWA Engine – Type definitions
 * Self-contained module: no imports from the rest of the codebase.
 */

/** Every role/context that gets its own unique PWA */
export type PWARole =
  | 'customer'           // Bedi Homepage PWA
  | 'customer-business'  // Per-business customer PWA (e.g. King Broast)
  | 'driver'             // Bedi Driver PWA
  | 'tenant-dashboard'   // Bedi Business dashboard (all businesses)
  | 'business-manage'    // Per-business management PWA
  | 'business-orders'    // Per-business orders PWA

/** Configuration object that fully describes a unique PWA instance */
export interface PWAConfig {
  role: PWARole
  /** Business slug (only for per-business PWAs) */
  slug?: string
  /** Display name (e.g. "King Broast", "Bedi Driver") */
  name: string
  /** Short name for home screen (max 12 chars) */
  shortName: string
  /** Description for manifest & SEO */
  description: string
  /** Icon URL (e.g. "/driversLogo.webp" or "/t/kingbroast/icon/192") */
  icon: string
  /** Start URL when app is launched */
  startUrl: string
  /** SW scope */
  scope: string
  /** SW script URL */
  swUrl: string
  /** Manifest URL */
  manifestUrl: string
  /** Push subscription API endpoint (e.g. "/api/driver/push-subscription") */
  fcmEndpoint?: string
  /** Theme color */
  themeColor?: string
  /** Background color */
  backgroundColor?: string
  /** Whether the SW should skipWaiting on install (true for customer roles) */
  swSkipWaiting?: boolean
  /** Variant: "fixed" = floating bottom sheet, "inline" = embedded card */
  variant?: 'fixed' | 'inline'
}

/** Browser beforeinstallprompt event */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/** OS/platform detection result */
export interface OSInfo {
  isIOS: boolean
  isAndroid: boolean
  isDesktop: boolean
  isStandalone: boolean
}

/** Install prompt state returned by useInstallPrompt */
export interface InstallPromptState {
  /** Whether native install prompt is available (Android/Desktop Chromium) */
  canInstall: boolean
  /** Whether the install card should be shown */
  showPrompt: boolean
  /** Whether install is in progress */
  installing: boolean
  /** Trigger the native install prompt */
  triggerInstall: () => Promise<void>
  /** Dismiss for default period (24h) */
  dismiss: () => void
  /** Dismiss for extended period (7 days) */
  dismissExtended: () => void
  /** Show fallback hint when no native prompt */
  showFallbackHint: boolean
}

/** FCM setup state returned by useFCMSetup */
export interface FCMState {
  /** Current notification permission */
  permission: NotificationPermission | null
  /** Whether push is being set up */
  loading: boolean
  /** Request notification permission and register FCM token */
  requestPush: () => Promise<boolean>
}

/** iOS "Add to Home Screen" instruction step */
export interface InstallStep {
  number: number
  text: string
  icon?: 'share' | 'plus'
}
