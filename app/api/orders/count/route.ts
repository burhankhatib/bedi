import { NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'

export async function GET() {
  try {
    const query = `count(*[_type == "order" && status == "pending"])`
    const pendingCount = await client.fetch(query)

    return NextResponse.json({ pendingCount })
  } catch (error) {
    console.error('Error fetching order count:', error)
    return NextResponse.json(
      { error: 'Failed to fetch order count' },
      { status: 500 }
    )
  }
}
