/**
 * PWA Engine – Barrel Export
 * Single import point: import { usePWA, getPWAConfig, ... } from '@/lib/pwa'
 */

// Types
export type {
  PWARole,
  PWAConfig,
  BeforeInstallPromptEvent,
  OSInfo,
  InstallPromptState,
  FCMState,
  InstallStep,
} from './types'

// Constants
export {
  MANIFEST_VERSION,
  DISMISS_HOURS_DEFAULT,
  DISMISS_HOURS_EXTENDED,
  ROLE_ICONS,
  ROLE_THEME_COLORS,
  ROLE_NOTIFICATION_TAGS,
  ROLE_NOTIFICATION_TITLES,
  ROLE_DEFAULT_URLS,
  ROLE_DEFAULT_DIR,
  SKIP_WAITING_ROLES,
} from './constants'

// Detection
export { detectOS, isStandaloneMode, getIOSInstallSteps, getIOSLabels } from './detect'

// SW Registration
export { registerServiceWorker, injectManifest, getRegistration } from './sw-registration'

// Config Factories
export {
  getPWAConfig,
  getCustomerPWAConfig,
  getCustomerBusinessPWAConfig,
  getDriverPWAConfig,
  getTenantDashboardPWAConfig,
  getBusinessManagePWAConfig,
  getBusinessOrdersPWAConfig,
} from './configs'
