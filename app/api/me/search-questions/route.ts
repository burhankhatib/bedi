import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { getOrCreateCustomer } from '@/lib/customer-helpers'

const writeClient = client.withConfig({
  token: token || undefined,
  useCdn: false,
})

/** Format questions array to newline-separated string. */
function formatQuestions(questions: string[]): string {
  return questions.filter(Boolean).join('\n')
}

/** POST /api/me/search-questions — Append a question to customer's aiSearchQuestions text. */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 })
    }

    const body = await req.json()
    const { question } = body as { question?: string }
    const q = typeof question === 'string' ? question.trim() : ''
    if (!q) {
      return NextResponse.json({ error: 'question is required' }, { status: 400 })
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
    const newContent = current ? `${current}\n${q}` : q

    await writeClient.patch(customerId).set({ aiSearchQuestions: newContent }).commit()

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[API] Save search question failed:', e)
    return NextResponse.json({ error: 'Failed to save question' }, { status: 500 })
  }
}

/** GET /api/me/search-questions — List user's questions from customer aiSearchQuestions (newest last). */
export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 })
    }

    const customer = await client.fetch<{ aiSearchQuestions?: string | null } | null>(
      `*[_type == "customer" && clerkUserId == $userId][0]{ aiSearchQuestions }`,
      { userId }
    )

    const text = customer?.aiSearchQuestions ?? ''
    const lines = text.split('\n').map((s) => s.trim()).filter(Boolean)
    const questions = lines.map((q, i) => ({ _id: `line-${i}`, question: q, askedAt: '' })).reverse()

    return NextResponse.json({ questions })
  } catch (e) {
    console.error('[API] List search questions failed:', e)
    return NextResponse.json({ error: 'Failed to load questions' }, { status: 500 })
  }
}

/** DELETE /api/me/search-questions?id=line-N — Delete one by index. No id = clear all. */
export async function DELETE(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 })
    }

    const customer = await writeClient.fetch<{ _id: string; aiSearchQuestions?: string | null } | null>(
      `*[_type == "customer" && clerkUserId == $userId][0]{ _id, aiSearchQuestions }`,
      { userId }
    )

    if (!customer) {
      return NextResponse.json({ success: true })
    }

    const id = req.nextUrl.searchParams.get('id')
    const text = (customer.aiSearchQuestions ?? '').trim()
    const lines = text ? text.split('\n').map((s) => s.trim()).filter(Boolean) : []

    if (id) {
      const match = id.match(/^line-(\d+)$/)
      const idx = match ? parseInt(match[1]!, 10) : -1
      if (idx >= 0 && idx < lines.length) {
        lines.splice(lines.length - 1 - idx, 1)
      }
    } else {
      lines.length = 0
    }

    const newContent = formatQuestions(lines)
    await writeClient.patch(customer._id).set({ aiSearchQuestions: newContent }).commit()

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[API] Delete search questions failed:', e)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
