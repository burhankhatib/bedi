/**
 * Explicit layout for /search to avoid removeChild during section/category navigation.
 * Next.js needs a stable layout boundary for client-side param transitions.
 */
export default function SearchLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
