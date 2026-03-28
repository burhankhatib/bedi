import { SignInAuthSection } from '@/components/Auth/SignInAuthSection'
import { getAllowedRedirectPath } from '@/lib/auth-utils'

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string }>
}) {
  const { redirect_url } = await searchParams
  const destination = getAllowedRedirectPath(redirect_url, '/')
  // Route through /auth/continue to check phone verification (OAuth users may need to verify)
  const afterSignInUrl = `/auth/continue?returnTo=${encodeURIComponent(destination)}`
  const signUpUrl = redirect_url ? `/sign-up?redirect_url=${encodeURIComponent(redirect_url)}` : '/sign-up'
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 pb-12 pt-[max(3rem,env(safe-area-inset-top,0px))]">
      <SignInAuthSection afterSignInUrl={afterSignInUrl} signUpUrl={signUpUrl} redirectUrl={redirect_url} />
    </div>
  )
}
