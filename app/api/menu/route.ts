import { NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { MENU_QUERY } from '@/sanity/lib/queries'
import { applyProductSortToMenuData } from '@/lib/sort-menu-products'
import { InitialData } from '@/app/types/menu'

/** Cache menu for 60s to reduce Sanity API calls on repeated visits / refreshes. */
export const revalidate = 60

const defaultData: InitialData = {
  categories: [],
  popularProducts: [],
  restaurantInfo: null,
  aboutUs: null,
}

export async function GET() {
  try {
    const menuData = (await client.fetch<InitialData>(MENU_QUERY)) ?? defaultData
    if (menuData.categories?.length) {
      applyProductSortToMenuData(menuData.categories)
    }
    return NextResponse.json(menuData)
  } catch (error) {
    console.error('[API] Failed to fetch menu data:', error)
    return NextResponse.json(defaultData, { status: 503 })
  }
}
