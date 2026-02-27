import { NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { MENU_QUERY } from '@/sanity/lib/queries'
import { InitialData } from '@/app/types/menu'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const defaultData: InitialData = {
  categories: [],
  popularProducts: [],
  restaurantInfo: null,
  aboutUs: null,
}

export async function GET() {
  try {
    const menuData = (await client.fetch<InitialData>(MENU_QUERY)) ?? defaultData
    return NextResponse.json(menuData)
  } catch (error) {
    console.error('[API] Failed to fetch menu data:', error)
    return NextResponse.json(defaultData, { status: 503 })
  }
}
