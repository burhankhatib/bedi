'use client'

import { useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { OnboardingRoleChoice } from './OnboardingRoleChoice'
import { CreateBusinessForm } from './CreateBusinessForm'

/**
 * When showRoleChoice: show "Create business" vs "I'm a driver" first.
 * Driver → /driver/profile. Business → show CreateBusinessForm.
 */
export function OnboardingClient({ showRoleChoice }: { showRoleChoice: boolean }) {
  const { isLoaded, userId } = useAuth()
  const router = useRouter()
  const [step, setStep] = useState<'choice' | 'form'>('choice')

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <Loader2 className="size-8 animate-spin text-amber-500" />
      </div>
    )
  }

  if (!userId) {
    router.replace('/sign-in?redirect_url=/onboarding')
    return null
  }

  if (showRoleChoice && step === 'choice') {
    return <OnboardingRoleChoice onChooseBusiness={() => setStep('form')} />
  }

  return <CreateBusinessForm />
}
