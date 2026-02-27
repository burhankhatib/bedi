# Phone-only sign-up / sign-in (direct verification)

When Clerk is configured for **phone only** (email and username sign-up/sign-in disabled), you can use these routes so the verification code is sent **immediately** after the user enters their phone—no extra "add phone" step or redirect to `/verify-phone`.

## Routes

| Purpose   | New route (direct flow)     | Original route   |
|----------|-----------------------------|------------------|
| Sign up  | `/sign-up-phone?redirect_url=...` | `/sign-up?redirect_url=...` |
| Sign in  | `/sign-in-phone?redirect_url=...` | `/sign-in?redirect_url=...` |

## Flow

1. **Sign up**: User enters phone → code is sent automatically → user enters code → account created and session set → redirect to `redirect_url` (no stop at `/verify-phone`).
2. **Sign in**: User enters phone → code is sent automatically → user enters code → signed in → redirect to `redirect_url`.

## How to switch

- Point "Sign up" / "Create account" links to `/sign-up-phone` instead of `/sign-up` (with the same `redirect_url` query when needed).
- Point "Sign in" links to `/sign-in-phone` instead of `/sign-in`.

Example: `/sign-up?redirect_url=/driver/profile` → `/sign-up-phone?redirect_url=/driver/profile`

## How to revert

- Change links back to `/sign-up` and `/sign-in`. The existing Clerk components and `/verify-phone` are unchanged.

## Files (new only)

- `app/(main)/sign-up-phone/page.tsx`
- `app/(main)/sign-up-phone/SignUpPhoneDirectClient.tsx`
- `app/(main)/sign-in-phone/page.tsx`
- `app/(main)/sign-in-phone/SignInPhoneDirectClient.tsx`

No existing files were modified.
