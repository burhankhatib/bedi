import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import VerifyPhoneClient from './VerifyPhoneClient'

export default async function VerifyPhonePage() {
  const { userId } = await auth()
  if (!userId) {
    redirect('/sign-in?redirect_url=' + encodeURIComponent('/verify-phone'))
  }
  return <VerifyPhoneClient />
}
