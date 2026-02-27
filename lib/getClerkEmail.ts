/**
 * Get email from Clerk session claims. Clerk may expose it as
 * sessionClaims.email, sessionClaims.primary_email_address (object), or
 * sessionClaims.email_address. By default Clerk does NOT include email in the
 * JWT, so this often returns '' — use getEmailForUser() in server code to
 * fall back to Clerk API.
 */
export function getEmailFromClaims(sessionClaims: Record<string, unknown> | null | undefined): string {
  if (!sessionClaims) return ''
  try {
    const raw =
      sessionClaims.email ??
      sessionClaims.email_address ??
      sessionClaims.primary_email_address
    if (typeof raw === 'string') return raw.trim()
    if (raw && typeof raw === 'object' && 'email_address' in raw)
      return String((raw as { email_address?: string }).email_address ?? '').trim()
    if (raw && typeof raw === 'object' && 'emailAddress' in raw)
      return String((raw as { emailAddress?: string }).emailAddress ?? '').trim()
  } catch {
    return ''
  }
  return ''
}

/**
 * Get the current user's email for access checks. Tries session claims first;
 * if empty (Clerk often omits email from the JWT), fetches the user from
 * Clerk API. Use this in admin layout, dashboard, and API routes.
 */
export async function getEmailForUser(
  userId: string,
  sessionClaims: Record<string, unknown> | null | undefined
): Promise<string> {
  const fromClaims = getEmailFromClaims(sessionClaims)
  if (fromClaims) return fromClaims
  try {
    const { clerkClient } = await import('@clerk/nextjs/server')
    const client = await clerkClient()
    const user = await client.users.getUser(userId)
    return (
      user.primaryEmailAddress?.emailAddress ??
      user.emailAddresses?.[0]?.emailAddress ??
      ''
    ).trim()
  } catch {
    return ''
  }
}
