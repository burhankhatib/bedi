import { SignUpAuthSection } from '@/components/Auth/SignUpAuthSection'
import { getAllowedRedirectPath } from '@/lib/auth-utils'

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string }>
}) {
  const { redirect_url } = await searchParams
  const allowedRedirect = getAllowedRedirectPath(redirect_url, '/')
  const afterSignUpUrl = `/verify-phone?returnTo=${encodeURIComponent(allowedRedirect)}`
  const signInUrl = redirect_url ? `/sign-in?redirect_url=${encodeURIComponent(allowedRedirect)}` : '/sign-in'

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 pb-12 pt-[max(3rem,env(safe-area-inset-top,0px))]">
      <SignUpAuthSection afterSignUpUrl={afterSignUpUrl} signInUrl={signInUrl} redirectUrl={redirect_url} />
    </div>
  )
}
