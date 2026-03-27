import { SignIn } from '@clerk/nextjs'
import { NativeGoogleSignInButton } from '@/components/Auth/NativeGoogleSignInButton'
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
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12">
      <div className="mx-auto w-full max-w-md space-y-4">
        <NativeGoogleSignInButton mode="sign-in" redirectUrl={redirect_url} className="px-1" />
        <SignIn
          appearance={{
            variables: { colorPrimary: '#f59e0b' },
            elements: {
              rootBox: 'mx-auto',
              card: 'shadow-xl border border-slate-800 bg-slate-900',
            },
          }}
          afterSignInUrl={afterSignInUrl}
          signUpUrl={signUpUrl}
        />
      </div>
    </div>
  )
}
