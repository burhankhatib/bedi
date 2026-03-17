/**
 * POST /api/search/ingredients-by-store
 * Fetch ingredient products for a specific store (used when user picks from store choice).
 */
import { NextResponse } from 'next/server'
import { searchIngredients } from '@/lib/ai/search-tools'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { ingredients, storeSlug, city = '', country = '', preferOpenOnly, sortBy } = body as {
      ingredients?: string[]
      storeSlug?: string
      city?: string
      country?: string
      preferOpenOnly?: boolean
      sortBy?: 'price_asc' | 'popularity'
    }

    const cityVal = (city ?? '').trim()
    if (!cityVal || !storeSlug || !Array.isArray(ingredients) || ingredients.length === 0) {
      return NextResponse.json(
        { error: 'ingredients, storeSlug, and city are required' },
        { status: 400 }
      )
    }

    const result = await searchIngredients({
      city: cityVal,
      country: (country ?? '').trim(),
      ingredients,
      preferOpenOnly,
      sortBy,
      storeSlug,
    })

    return NextResponse.json(result)
  } catch (e) {
    console.error('[search/ingredients-by-store]', e)
    return NextResponse.json({ error: 'Failed to fetch ingredients' }, { status: 500 })
  }
}
