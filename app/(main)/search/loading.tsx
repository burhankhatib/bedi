import { SearchPageSkeleton } from '@/components/loading'

/**
 * Shown when navigating to /search.
 * Matches SearchPageClient layout so users see what's loading.
 */
export default function SearchLoading() {
  return <SearchPageSkeleton />
}
