import { SignUp } from '@clerk/nextjs'
import { getAllowedRedirectPath } from '@/lib/auth-utils'

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string }>
}) {
  const { redirect_url } = await searchParams
  const allowedRedirect = getAllowedRedirectPath(redirect_url, '/')
  const afterSignUpUrl = `/verify-phone?returnTo=${encodeURIComponent(allowedRedirect)}`
  
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12">
      <SignUp
        appearance={{
          variables: { colorPrimary: '#f59e0b' },
          elements: {
            rootBox: 'mx-auto',
            card: 'shadow-xl border border-slate-800 bg-slate-900',
          },
        }}
        afterSignUpUrl={afterSignUpUrl}
        signInUrl={redirect_url ? `/sign-in?redirect_url=${encodeURIComponent(allowedRedirect)}` : '/sign-in'}
      />
    </div>
  )
}
