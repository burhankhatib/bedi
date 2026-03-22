import { client } from '@/sanity/lib/client'
import { checkTenantAuth } from '@/lib/tenant-auth'

export async function verifyRaterAccess(clerkUserId: string, role: string, raterId: string): Promise<boolean> {
  if (role === 'customer') {
    const customer = await client.fetch<{ _id: string } | null>(
      `*[_type == "customer" && clerkUserId == $clerkUserId][0]{ _id }`,
      { clerkUserId }
    )
    return customer?._id === raterId
  }

  if (role === 'driver') {
    const driver = await client.fetch<{ _id: string } | null>(
      `*[_type == "driver" && clerkUserId == $clerkUserId][0]{ _id }`,
      { clerkUserId }
    )
    return driver?._id === raterId
  }

  if (role === 'business') {
    // raterId is the siteId / tenant id or slug. 
    // If raterId is the Sanity document ID of the tenant, checkTenantAuth uses slug.
    // Let's lookup the slug for this tenant _id first.
    const tenant = await client.fetch<{ "slug": string } | null>(
      `*[_type == "tenant" && _id == $raterId][0]{ "slug": slug.current }`,
      { raterId }
    )
    if (!tenant?.slug) return false
    
    // checkTenantAuth uses Clerk internally, so we just need to verify the user has access.
    // However, checkTenantAuth checks the current authenticated user context.
    const authRes = await checkTenantAuth(tenant.slug)
    return authRes.ok
  }

  return false
}
