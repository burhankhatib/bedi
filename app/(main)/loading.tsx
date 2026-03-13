import { HomePageSkeleton } from '@/components/loading'

/**
 * Shown during route transitions for (main) segment: /, /about, /contact, etc.
 * HomePageSkeleton for primary use case (home). Acceptable for other pages.
 */
export default function MainLoading() {
  return <HomePageSkeleton />
}
