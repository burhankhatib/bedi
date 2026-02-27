import { StudioAuthGuard } from './StudioAuthGuard'

/**
 * Minimal layout: no server-side auth to avoid Next.js "immutable" Headers error
 * (Clerk auth runs client-side in StudioAuthGuard).
 */
export default function StudioLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <StudioAuthGuard>{children}</StudioAuthGuard>
}
