# Zonify UX & Performance Audit Report

**Date:** March 17, 2025  
**Scope:** Customer, Tenant Dashboard, Driver areas  
**Focus:** Auth entry points, modals/overlays, navigation, performance, pull-to-refresh, premium SaaS patterns

---

## A. Auth Flow Audit

### Auth Entry Points (Where Sign-in/Sign-up is triggered)

| Location | Component/Path | Type | Notes |
|----------|----------------|------|-------|
| **OrderAuthGate** | `components/OrderAuthGate.tsx` | Clerk modal | `SignInButton mode="modal"`, `SignUpButton mode="modal"` — used when placing order requires auth |
| **MenuLayout** | `components/Menu/MenuLayout.tsx` | Clerk modal | Desktop: `SignInButton`/`SignUpButton` mode="modal" (lines 551–552). Mobile sheet: same (603–608) |
| **CartSlider** | `components/Cart/CartSlider.tsx` | Clerk modal (via OrderAuthGate) | Embeds `OrderAuthGate` when `needsSignIn`/`needsPhoneVerification` (689–696) |
| **AppNavClient** | `components/saas/AppNavClient.tsx` | Link | `<Link href="/sign-in">` (102, 174) — direct Link, no modal |
| **SiteHeader** | `components/global/SiteHeader.tsx` | Link | `AuthEntryButton` uses `<Link href="/sign-in?redirect_url=/"` (69–74) — already migrated to Link |
| **Public pages** | About, Contact, Pricing, Product, Join, Legal | Link | Pass `signInLabel` to AppNav; AppNav uses Link |
| **Error pages** | `error.tsx`, `global-error.tsx`, `not-found.tsx`, `dashboard/error.tsx`, `driver/error.tsx`, `orders/error.tsx`, `studio/error.tsx` | `window.location.href` or Link | Error recovery — often full reload |
| **Redirect flows** | Dashboard, Driver layout | `redirect()` | Server-side redirect to `/sign-in` when unauthenticated |
| **proxy.ts** | Server middleware | `signInRedirect()` | Returns redirect response for API/proxy paths |

### Recommended Changes

1. **Replace Clerk modal auth with direct Link** where triggered from within overlays:
   - **OrderAuthGate** (high): Used inside CartSlider (Sheet). Replace `SignInButton mode="modal"` with `<Link href={signInUrl}>` and `SignUpButton mode="modal"` with `<Link href={signUpUrl}>`. Avoids modal-on-sheet stack and freeze risk.
   - **MenuLayout** (high): Sign-in/up inside mobile Sheet. Replace modal triggers with `<Link href={signInUrl}>` / `<Link href={signUpUrl}>` to avoid Sheet + Clerk modal conflict.
   - Keep modal for non-overlay contexts if desired, but prioritize Link for consistency.

2. **Error pages**: Prefer `router.push()` over `window.location.href` where possible to retain SPA behavior; use `window.location` only when a full reload is required (e.g. after auth/error recovery).

3. **Verify-phone flow**: Already uses Link where appropriate. `window.location.href` for post-verify redirect is acceptable (session/state refresh).

---

## B. Modal/Overlay Audit

### Modals & Overlays by Area

| Modal | Component | Type | Location | Pull-to-Refresh Check |
|-------|-----------|------|----------|------------------------|
| **LocationModal** | `components/global/LocationModal.tsx` | Radix Dialog | Search, LocationGate, SiteHeader | ✅ Body overflow lock — `isOverlayOpen` catches it |
| **CartSlider** | `components/Cart/CartSlider.tsx` | Radix Sheet | Customer (Menu, Search, etc.) | ✅ Radix sets body scroll lock |
| **UnifiedOrderDialog** | `components/Cart/UnifiedOrderDialog.tsx` | Radix Dialog | Opened from CartSlider | ✅ Nested inside Sheet; Radix locks body |
| **BrowseMenuModal** | `components/Orders/BrowseMenuModal.tsx` | Custom (Framer Motion) | OrderTrackClient, DriverOrdersV2 | ⚠️ No body scroll lock; relies on fixed overlay capturing touches |
| **OrderDetailsModal** | `components/Orders/OrderDetailsModal.tsx` | Custom overlay | OrdersClient, HistoryOrdersClient, AdminOrderViewClient, DriverOrdersV2 | ⚠️ Same as BrowseMenuModal |
| **OrderNotifications** | `components/Orders/OrderNotifications.tsx` | Radix Dialog | Tenant orders, Driver orders | ✅ Radix body lock |
| **CatalogProductsModal** | `app/(main)/t/[slug]/manage/menu/CatalogProductsModal.tsx` | Radix Dialog | Tenant menu management | N/A — Tenant has no pull-to-refresh |
| **ProductFormModal** | `app/(main)/t/[slug]/manage/menu/ProductFormModal.tsx` | Radix Dialog | Tenant menu management | N/A |
| **ReportFormModal** | `components/Reports/ReportFormModal.tsx` | Radix Dialog | Opened from OrderDetailsModal | Nested: custom overlay → Dialog |
| **PWA dialogs** | PWAInstall, PWAAppBanners, PWAPermissions | Radix Dialog | Various | ✅ Radix body lock |
| **Admin dialogs** | Admin catalog, businesses, drivers, areas | Radix Dialog/Sheet | Admin area | N/A — no pull-to-refresh |
| **ManageNavClient** | Upgrade modal | Radix Dialog | Tenant manage nav | N/A |
| **CartContext** | Cart conflict confirm | Radix Dialog | Cart flow | ✅ Radix body lock |

### Pull-to-Refresh vs Overlays

- **CustomerPullToRefresh** (`components/customer/CustomerPullToRefresh.tsx`): Uses `isOverlayOpen()` checking `document.body.style.overflow === 'hidden'` and `document.body.getAttribute('data-scroll-locked')`. Correctly skips when Radix Dialog/Sheet is open.
- **DriverPullToRefresh** (`app/(main)/driver/DriverPullToRefresh.tsx`): **Does NOT** use `isOverlayOpen()`. When BrowseMenuModal or OrderDetailsModal is open on Driver, pull-to-refresh can still fire. **Gap**: Add `isOverlayOpen()` checks to Driver pull-to-refresh handlers.
- **CustomerIOSPullToRefresh** (pulltorefreshjs): Uses `shouldPullToRefresh: () => window.scrollY <= 10` only. **Does NOT** check overlays. On iOS PWA with Sheet/Dialog open, pull could still trigger. **Gap**: Extend `shouldPullToRefresh` to return false when `document.body.style.overflow === 'hidden'` or `data-scroll-locked`.
- **DriverIOSPullToRefresh**: Same pattern as CustomerIOSPullToRefresh; same gap.

### Nested Modal Stacks

- **CartSlider (Sheet) → UnifiedOrderDialog (Dialog)** — Radix Sheet + Radix Dialog. Radix generally handles nested portals; monitor for focus-trap or scroll-lock issues.
- **OrderDetailsModal (custom) → ReportFormModal (Dialog)** — Custom overlay opens Radix Dialog. Potential focus trap or z-index issues; verify stacking and behavior.
- **BrowseMenuModal** and **OrderDetailsModal** are custom overlays (fixed inset-0). They do not set `body overflow` or `data-scroll-locked`. Touches are captured by the overlay; risk is low but adding scroll lock would be safer.

### Recommendations

1. Add `isOverlayOpen()` to **DriverPullToRefresh** (mirror CustomerPullToRefresh).
2. Extend **CustomerIOSPullToRefresh** and **DriverIOSPullToRefresh** so `shouldPullToRefresh` returns false when `isOverlayOpen()` (or equivalent) is true.
3. Optional: For **BrowseMenuModal** and **OrderDetailsModal**, add `useEffect` to set `body.style.overflow = 'hidden'` when open and restore on close, so `isOverlayOpen` is consistent.
4. Monitor nested stacks (Sheet→Dialog, custom overlay→Dialog) for focus/scroll issues on real devices.

---

## C. Navigation Audit

### Link vs `<a href>` vs Full Page Load

| Pattern | Usage | Files | Assessment |
|---------|-------|-------|------------|
| **Link (next/link)** | In-app navigation | AppNavClient, SiteHeader, StoreTypeSidebar, ProductPageClient, JoinPageClient, etc. | ✅ Preferred |
| **FullPageLink** | `window.location.href` on click | MenuLayout, SearchPageClient, MobileBottomNav, CategoryIconsBar | Intentional: avoids Radix portal race during navigation (removeChild). Use when Link causes reconciliation issues. |
| **router.push()** | Programmatic nav | CartSlider, CartContext, UniversalSearch, DriverLayoutClient, SignUpPhone, etc. | ✅ Correct |
| **window.location.href** | Full reload | VerifyPhoneClient, DriverProfileClient, DriverHomeRedirect, error pages, BillingManageClient (payment redirect) | Used where full reload or external redirect is needed. |

### Issues Found

1. **AppNavClient** (lines 211–255): Uses `<a href="...">` instead of `<Link>` in some mobile/expanded views. Recommend switching to `Link` for in-app routes.
2. **DriverHomeRedirect** (`app/(main)/driver/DriverHomeRedirect.tsx`): Uses `window.location.href` for redirect. Consider `router.replace()` for in-app redirects when no hard reload is needed.
3. **DriverLayoutClient** (90–96): Uses `window.location.href` as fallback when `router.replace` doesn’t navigate. Reasonable for profile redirect edge cases.
4. **FullPageLink**: Documented workaround for Radix portal issues; acceptable for specific routes (e.g. tenant menu → home, category bar).
5. **External links** (`tel:`, `https://`, `mailto:`): Correctly use `<a href>` — no change needed.

### Recommendations

1. Replace in-app `<a href>` with `Link` in AppNavClient where it applies to internal routes.
2. Prefer `router.push()` / `router.replace()` over `window.location.href` for auth and error recovery where a full reload is not necessary.
3. Keep FullPageLink for routes known to trigger Radix reconciliation issues.

---

## D. Performance Recommendations

### Dynamic Imports / Lazy Loading

| Component | Status | Location |
|-----------|--------|----------|
| react-leaflet (MapContainer, TileLayer) | ✅ `dynamic` | AreasMap |
| StudioClient | ✅ `dynamic` | StudioLoader |
| HeroBanner | ✅ `lazy` | HomePageNew |
| DriverHistoryClient | ✅ `dynamic` | DriverHistoryPageClient |
| DriverAnalyticsClient | ✅ `dynamic` | DriverAnalyticsPageClient |
| LocationPickerMap | ✅ `dynamic` | UnifiedOrderDialog, BusinessManageClient |
| DriverNavigationMap | ✅ `dynamic` | DriverOrdersV2 |
| ReportFormModal | ✅ `dynamic` | DriverHistoryClient |

**Candidates for dynamic import:**

- **OrderDetailsModal** — Large component (~2000+ lines); consider lazy loading when opened.
- **BrowseMenuModal** — Moderate size; consider lazy load on open.
- **CatalogProductsModal** — Tenant menu management; consider lazy load.
- **ProductFormModal** — Form-heavy; consider lazy load.
- **SearchAIPanel** / **ChatFab** — AI/search features; consider lazy load on expand.

### Loading Skeletons

| Route | Skeleton | File |
|-------|----------|------|
| `/` (root) | HomePageSkeleton | `app/loading.tsx` |
| `/search` | SearchPageSkeleton | `app/(main)/search/loading.tsx` |
| `/t/[slug]` | TenantPageSkeleton | `app/(main)/t/[slug]/loading.tsx` |
| `/order` | OrderPageSkeleton | `app/(main)/order/page.tsx` |
| `/verify-phone` | FormSkeleton | `app/(main)/verify-phone/page.tsx` |
| `/driver/profile` | FormSkeleton | `app/(main)/driver/profile/page.tsx` |
| `/suspended` | DarkPageSkeleton | `app/(main)/suspended/page.tsx` |
| (main) layout | PageSkeleton | `app/(main)/layout.tsx` |

**Missing skeletons:**

- `/driver/orders` — Heavy page; add DriverOrdersSkeleton.
- `/driver/history` — Add skeleton while DriverHistoryClient loads.
- `/my-orders` — Add OrdersListSkeleton.
- `/t/[slug]/manage/*` — Add ManageSkeleton for tenant dashboard routes.
- `/admin/*` — Add AdminSkeleton for admin routes.
- `/dashboard` — Add DashboardSkeleton.

### Blocking Operations on Mount

- **DriverLayoutClient**: Profile check on mount; uses abort controller — acceptable.
- **CustomerAreaWrapper**: `useScrollToTopOnNavigate` — lightweight.
- **PWA/service worker registration**: Inline script with `strategy="beforeInteractive"` in layout — runs early; acceptable for SW.
- **Tenant/Dashboard/Driver SW**: Path-based registration; runs before paint — acceptable.

### Service Worker Strategy

- **Current**: `strategy="beforeInteractive"` in `app/layout.tsx` (line 155). Inline script registers SW based on path.
- **Assessment**: beforeInteractive ensures SW is registered before main app; suitable for PWA.
- **Recommendation**: Consider `afterInteractive` for non-critical routes if beforeInteractive delays FCP; profile before changing.

---

## E. Pull-to-Refresh Summary

| Area | Component | Has PTR? | Overlay Check? | Notes |
|------|-----------|----------|----------------|-------|
| Customer (web) | CustomerPullToRefresh | ✅ | ✅ `isOverlayOpen()` | Wraps main content |
| Customer (iOS PWA) | CustomerIOSPullToRefresh | ✅ pulltorefreshjs | ❌ | No overlay check; add one |
| Driver (web) | DriverPullToRefresh | ✅ | ❌ | Add `isOverlayOpen()` |
| Driver (iOS PWA) | DriverIOSPullToRefresh | ✅ pulltorefreshjs | ❌ | No overlay check; add one |
| Driver Orders | DriverOrdersV2 inline | ✅ | N/A | Own PTR logic; verify overlay handling |
| Tenant Dashboard | — | ❌ | N/A | No pull-to-refresh |

**Conflict avoidance:** CustomerAreaWrapper skips Customer pull-to-refresh on driver paths. Driver and Customer PTR do not run on the same routes.

---

## F. Premium SaaS Patterns Checklist

| Pattern | Status | Notes |
|---------|--------|-------|
| **Instant tap feedback (no 300ms)** | ✅ | `touch-action: manipulation` in `globals.css`; `touch-manipulation` on buttons/nav |
| **Skeleton loaders** | ⚠️ Partial | Home, Search, Tenant, Order, Verify, Suspended have skeletons; Driver, My-orders, Admin, Dashboard need more |
| **Optimistic UI** | ⚠️ Partial | TenantPushContext, MenuManageClient, OrdersClient, DriverOrdersV2 use optimistic updates; extend where appropriate |
| **No janky modals** | ⚠️ Risk | Clerk modal + Radix Sheet can conflict; migrate auth to Link where possible |
| **Fast transitions** | ✅ | Framer Motion; M3-like easing (200–300ms) in multiple places |
| **active:scale feedback** | ✅ | Buttons use `active:scale-[0.97]` / `active:scale-[0.98]` |
| **min-h-[48px] touch targets** | ✅ | Common on Driver and key Customer buttons |

---

## G. Prioritized Action List

### P0 (High — Stability & UX)

1. **Replace Clerk modal auth with Link in OrderAuthGate** — Used inside CartSlider; high freeze risk.
2. **Replace Clerk modal auth with Link in MenuLayout** — Used inside mobile Sheet; same risk.
3. **Add `isOverlayOpen()` to DriverPullToRefresh** — Prevents PTR when Driver modals are open.

### P1 (Medium — Consistency & Safety)

4. **Add overlay check to CustomerIOSPullToRefresh and DriverIOSPullToRefresh** — Extend `shouldPullToRefresh` to return false when overlay is open.
5. **Replace in-app `<a href>` with `Link` in AppNavClient** — Consistent client-side routing.
6. **Add scroll lock to custom modals** (BrowseMenuModal, OrderDetailsModal) — Set `body.style.overflow = 'hidden'` when open for consistent `isOverlayOpen` behavior.

### P2 (Lower — Polish & Performance)

7. **Add loading skeletons** for Driver orders, My-orders, Tenant manage, Admin, Dashboard.
8. **Lazy load OrderDetailsModal and BrowseMenuModal** — Reduce initial bundle.
9. **Lazy load CatalogProductsModal and ProductFormModal** — Tenant menu management.
10. **Prefer router over window.location** in error pages where full reload is not required.

### P3 (Nice-to-have)

11. **Extend optimistic UI** to more order/cart flows.
12. **Profile service worker strategy** — Consider afterInteractive for non-critical paths if needed.

---

## Appendix: File Reference

### Auth Components

- `components/OrderAuthGate.tsx` — Order-flow auth gate (modal)
- `components/Menu/MenuLayout.tsx` — Menu header + mobile sheet (modal)
- `components/saas/AppNavClient.tsx` — App nav (Link)
- `components/global/SiteHeader.tsx` — Site header (Link)

### Modal Components

- `components/global/LocationModal.tsx` — Location picker
- `components/Cart/CartSlider.tsx` — Cart (Sheet)
- `components/Cart/UnifiedOrderDialog.tsx` — Order type/details (Dialog)
- `components/Orders/BrowseMenuModal.tsx` — Browse menu (custom)
- `components/Orders/OrderDetailsModal.tsx` — Order details (custom)
- `components/Orders/OrderNotifications.tsx` — Order notification (Dialog)
- `app/(main)/t/[slug]/manage/menu/CatalogProductsModal.tsx`
- `app/(main)/t/[slug]/manage/menu/ProductFormModal.tsx`

### Pull-to-Refresh

- `components/customer/CustomerPullToRefresh.tsx`
- `components/customer/CustomerIOSPullToRefresh.tsx`
- `app/(main)/driver/DriverPullToRefresh.tsx`
- `app/(main)/driver/DriverIOSPullToRefresh.tsx`
- `components/customer/CustomerAreaWrapper.tsx` — Wrapper/orchestration

### Navigation

- `components/ui/FullPageLink.tsx` — Full page load Link
- `app/layout.tsx` — SW registration (beforeInteractive)
