import SignInPhoneDirectClient from './SignInPhoneDirectClient'

/**
 * Phone-only sign-in: enter phone → code sent → enter code → signed in.
 * Use /sign-in-phone?redirect_url=... when Clerk is configured for phone-only.
 */
export default function SignInPhonePage() {
  return <SignInPhoneDirectClient />
}
