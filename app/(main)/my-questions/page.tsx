import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { client } from '@/sanity/lib/client'
import { MyQuestionsClient } from './MyQuestionsClient'

export const dynamic = 'force-dynamic'

export type QuestionRow = {
  _id: string
  question: string
  askedAt: string
}

export default async function MyQuestionsPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in?redirect_url=/my-questions')

  let questions: QuestionRow[] = []
  try {
    const customer = await client.fetch<{ aiSearchQuestions?: string | null } | null>(
      `*[_type == "customer" && clerkUserId == $userId][0]{ aiSearchQuestions }`,
      { userId }
    )
    const text = customer?.aiSearchQuestions ?? ''
    const lines = text.split('\n').map((s) => s.trim()).filter(Boolean)
    questions = lines.reverse().map((q, i) => ({ _id: `line-${i}`, question: q, askedAt: '' }))
  } catch {
    questions = []
  }

  return <MyQuestionsClient initialQuestions={questions} />
}
