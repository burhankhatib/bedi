import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function DriverJoinPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const searchParams = await props.searchParams
  const ref = searchParams?.ref
  const { userId } = await auth()
  
  let target = '/driver/profile'
  if (ref) {
    target += `?ref=${ref}`
  }

  if (!userId) {
    redirect(`/sign-in?redirect_url=${encodeURIComponent(target)}`)
  }
  redirect(target)
}
