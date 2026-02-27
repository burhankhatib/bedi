import SignUpPhoneDirectClient from './SignUpPhoneDirectClient'

/**
 * Phone-only sign-up: one screen for phone, then verification code is sent
 * automatically; user enters code and account is created. No redirect to
 * verify-phone or second "add phone" step.
 * Use /sign-up-phone?redirect_url=... instead of /sign-up when Clerk is
 * configured for phone-only (email/username disabled).
 */
export default function SignUpPhonePage() {
  return <SignUpPhoneDirectClient />
}
