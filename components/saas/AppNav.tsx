import { AppNavClient } from './AppNavClient'

interface AppNavProps {
  /** Landing: show Sign in / Get started. Dashboard: show user + optional Admin */
  variant: 'landing' | 'dashboard'
  /** Show Admin link (e.g. when user is super admin) */
  showAdmin?: boolean
  /** Dashboard: show "Switch to Driver" when user has a driver profile */
  hasDriver?: boolean
  /** Landing only: custom labels for nav buttons */
  signInLabel?: string
  getStartedLabel?: string
  /** Optional trailing element (e.g. language switcher) */
  trailingElement?: React.ReactNode
}

export function AppNav({ variant, showAdmin, hasDriver, signInLabel, getStartedLabel, trailingElement }: AppNavProps) {
  return (
    <AppNavClient
      variant={variant}
      showAdmin={showAdmin}
      hasDriver={hasDriver}
      signInLabel={signInLabel}
      getStartedLabel={getStartedLabel}
      trailingElement={trailingElement}
    />
  )
}
