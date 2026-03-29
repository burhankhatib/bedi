import { DEFAULT_HOME_FILTERS, type HomePageFilters } from '@/components/home/QuickFiltersRow'

export const HOME_FILTERS_STORAGE_KEY = 'bedi.homeFeaturedListFilters.v1'

export function parseStoredHomeFilters(raw: string | null): HomePageFilters {
  if (!raw) return DEFAULT_HOME_FILTERS
  try {
    const o = JSON.parse(raw) as Record<string, unknown>
    const deliveryFee = o.deliveryFee
    const df =
      deliveryFee === 'free' || deliveryFee === 'under10' || deliveryFee === 'all'
        ? deliveryFee
        : DEFAULT_HOME_FILTERS.deliveryFee
    const minRating =
      typeof o.minRating === 'number' && Number.isFinite(o.minRating) ? o.minRating : null
    return {
      deliveryFee: df,
      dealOnly: typeof o.dealOnly === 'boolean' ? o.dealOnly : DEFAULT_HOME_FILTERS.dealOnly,
      minRating,
      fastest: typeof o.fastest === 'boolean' ? o.fastest : DEFAULT_HOME_FILTERS.fastest,
    }
  } catch {
    return DEFAULT_HOME_FILTERS
  }
}

export function persistHomeFilters(f: HomePageFilters): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(HOME_FILTERS_STORAGE_KEY, JSON.stringify(f))
  } catch {
    /* ignore quota / private mode */
  }
}
