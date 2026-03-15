import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

/** Driver invite landing: /driver/join?ref=REFERRAL_CODE
 * - Not logged in → sign-up (new drivers need to create account) with redirect to driver profile + ref preserved
 * - Logged in → driver profile with ref preserved */
export default async function DriverJoinPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const searchParams = await props.searchParams
  const refRaw = searchParams?.ref
  const ref = typeof refRaw === 'string' ? refRaw : Array.isArray(refRaw) ? refRaw[0] : undefined
  const { userId } = await auth()

  let target = '/driver/profile'
  if (ref && typeof ref === 'string') {
    target += `?ref=${encodeURIComponent(ref)}`
  }

  if (!userId) {
    redirect(`/sign-up?redirect_url=${encodeURIComponent(target)}`)
  }
  redirect(target)
}
