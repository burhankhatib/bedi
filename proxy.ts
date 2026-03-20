import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'

const isAdminRoute = createRouteMatcher(['/admin(.*)'])
const isStudioRoute = (path: string) => path.startsWith('/studio') || path.includes('/studio')
const isProtectedRoute = (path: string) =>
  path.startsWith('/dashboard') ||
  path.startsWith('/onboarding') ||
  path.startsWith('/driver') ||
  /^\/t\/[^/]+\/manage/.test(path)

/**
 * Public API routes: no auth() call — saves Clerk API usage for home, search, contact, public menus, webhooks.
 * Only paths that never need the current user should be listed here.
 */
function isPublicApiPath(path: string): boolean {
  if (!path.startsWith('/api/')) return false
  // Home discovery (cities, banners, categories, sections, tenants, popular-products, subcategories)
  if (path.startsWith('/api/home/')) return true
  if (path.startsWith('/api/search/')) return true
  if (path === '/api/countries' || path === '/api/cities') return true
  if (path === '/api/contact') return true
  if (path === '/api/menu') return true
  if (path === '/api/geo') return true
  if (path.startsWith('/api/areas')) return true
  // Public tracking: tenant track by token, order status for tracking
  if (/^\/api\/tenants\/[^/]+\/track\//.test(path)) return true
  if (path === '/api/orders/status') return true
  if (/^\/api\/tenants\/[^/]+\/orders\/status$/.test(path)) return true
  // Webhooks (Sanity, Prelude — use their own signature verification)
  if (path.startsWith('/api/webhooks/')) return true
  // Onboarding/registration forms (country/city/subcategory lists)
  if (path.startsWith('/api/business-subcategories')) return true
  // NVP/PayPal webhook
  if (path.startsWith('/api/nvp/')) return true
  // Public tenant data for menu/order flow (by-table, by-phone, track)
  if (/^\/api\/tenants\/[^/]+\/orders\/by-table$/.test(path)) return true
  if (/^\/api\/tenants\/[^/]+\/orders\/by-phone$/.test(path)) return true
  return false
}

const SUPER_ADMIN_EMAIL = 'burhank@gmail.com'

/**
 * Pass-through response for routes that skip full Clerk branching.
 * Do not use `NextResponse.next({ request: { headers } })` here: rewriting the request Headers
 * makes the response's Headers read-only in Node (undici), and Clerk then throws
 * `TypeError: immutable` when it tries `handlerResult.headers.append(...)` for auth cookies.
 */
function nextWithPath(req: NextRequest) {
  const res = NextResponse.next()
  // Disable caching for /t/* (tenant menu pages) so price/content updates appear immediately
  if (req.nextUrl.pathname.startsWith('/t/')) {
    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
    res.headers.set('Pragma', 'no-cache')
  }
  return res
}

/** Build sign-in URL with redirect back to the given path (so user sees Clerk login and then returns). */
function signInRedirect(req: Request, path: string): NextResponse {
  const url = new URL('/sign-in', req.url)
  url.searchParams.set('redirect_url', path)
  /** Must be NextResponse: undici `Response.redirect` has immutable headers; Clerk appends session cookies after. */
  return NextResponse.redirect(url)
}

/** Get email from session claims only (Edge-safe; no clerkClient). May be empty if email not in token. */
function getEmailFromClaims(sessionClaims: Record<string, unknown> | null): string {
  if (!sessionClaims) return ''
  try {
    const raw = sessionClaims.email ?? sessionClaims.email_address ?? sessionClaims.primary_email_address
    if (typeof raw === 'string') return raw
    if (raw && typeof raw === 'object' && 'email_address' in raw) return String((raw as { email_address?: string }).email_address ?? '')
    if (raw && typeof raw === 'object' && 'emailAddress' in raw) return String((raw as { emailAddress?: string }).emailAddress ?? '')
  } catch {
    return ''
  }
  return ''
}

const clerkHandler = clerkMiddleware(async (auth, req) => {
  const path = req.nextUrl.pathname

  // When iOS adds the driver page to home screen, it requests apple-touch-icon; serve driver icon so it doesn't get replaced by the generic one.
  const isAppleTouchIcon = path === '/apple-touch-icon.png' || path === '/apple-touch-icon-precomposed.png'
  if (isAppleTouchIcon && req.headers.get('referer')?.includes('/driver')) {
    return NextResponse.rewrite(new URL('/driversLogo.webp', req.url))
  }

  // Studio: skip Clerk in middleware to avoid Next.js "immutable" Headers error.
  // Auth is enforced client-side in app/studio/StudioAuthGuard.
  if (isStudioRoute(path)) {
    return nextWithPath(req)
  }

  // Public API routes: skip auth() to reduce Clerk API usage (home, search, contact, webhooks, etc.)
  if (path.startsWith('/api/') && isPublicApiPath(path)) {
    return nextWithPath(req)
  }

  try {
    const { userId, sessionClaims } = await auth()

    if (isProtectedRoute(path) || path.startsWith('/dashboard') || path.startsWith('/onboarding')) {
      if (!userId) return signInRedirect(req, path)
    }

    if (isAdminRoute(req)) {
      if (!userId) return signInRedirect(req, path)
      const resolvedAdminEmail = getEmailFromClaims(sessionClaims as Record<string, unknown> | null)
      const isSuperAdmin = resolvedAdminEmail.trim().toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()
      if (resolvedAdminEmail && !isSuperAdmin) {
        const redirect = new URL('/dashboard', req.url)
        redirect.searchParams.set('error', 'admin_only')
        return NextResponse.redirect(redirect)
      }
    }
  } catch {
    if (
      isProtectedRoute(path) ||
      isAdminRoute(req) ||
      isStudioRoute(path) ||
      path.startsWith('/dashboard') ||
      path.startsWith('/onboarding')
    ) {
      return signInRedirect(req, path)
    }
  }

  return nextWithPath(req)
})

/** Wrap Clerk handler so any thrown error (e.g. Clerk init or auth) for protected routes redirects to sign-in instead of 500. */
export default function middleware(req: NextRequest) {
  try {
    // Clerk's middleware expects (request, event); Next.js 16 proxy may call with (request) only — pass through.
    return (clerkHandler as (r: NextRequest) => Promise<Response>)(req)
  } catch {
    const path = req.nextUrl.pathname
    if (
      isProtectedRoute(path) ||
      path.startsWith('/dashboard') ||
      path.startsWith('/onboarding') ||
      isAdminRoute(req)
    ) {
      return signInRedirect(req, path)
    }
    return nextWithPath(req)
  }
}

export const config = {
  matcher: [
    // Skip Next.js internals, static files, and SEO files (sitemap, robots) for Google Search Console
    // sitemap.xml, sitemap/sitemap.xml, and sitemap/* must never hit middleware
    '/((?!_next|robots\\.txt|sitemap(?:\\.xml|/)|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|xml)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
    // Run for apple-touch-icon so we can serve driver icon when adding from /driver
    '/apple-touch-icon.png',
    '/apple-touch-icon-precomposed.png',
  ],
}
