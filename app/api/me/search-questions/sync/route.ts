import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { getOrCreateCustomer } from '@/lib/customer-helpers'

const writeClient = client.withConfig({
  token: token || undefined,
  useCdn: false,
})

/** POST /api/me/search-questions/sync — Append guest localStorage questions to customer's aiSearchQuestions. */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 })
    }

    const body = await req.json()
    const { questions } = body as { questions?: Array<{ question: string; askedAt?: string }> }
    const list = Array.isArray(questions) ? questions : []
    const valid = list
      .map((i) => (typeof i.question === 'string' ? i.question.trim() : ''))
      .filter(Boolean)
    if (valid.length === 0) {
      return NextResponse.json({ success: true, synced: 0 })
    }

    const customerId = await getOrCreateCustomer(userId)
    if (!customerId) {
      return NextResponse.json({ error: 'Failed to get customer' }, { status: 500 })
    }

    const customer = await writeClient.fetch<{ aiSearchQuestions?: string | null } | null>(
      `*[_type == "customer" && _id == $id][0]{ aiSearchQuestions }`,
      { id: customerId }
    )

    const current = (customer?.aiSearchQuestions ?? '').trim()
    const toAppend = valid.join('\n')
    const newContent = current ? `${current}\n${toAppend}` : toAppend

    await writeClient.patch(customerId).set({ aiSearchQuestions: newContent }).commit()

    return NextResponse.json({ success: true, synced: valid.length })
  } catch (e) {
    console.error('[API] Sync search questions failed:', e)
    return NextResponse.json({ error: 'Failed to sync questions' }, { status: 500 })
  }
}
