# Capacitor Phase 2: True Static Export (Offline Capability)

Currently, the native iOS/Android apps use a **Remote WebView** strategy (`server.url`). This means the apps act as native wrappers around your Vercel-hosted Next.js app. This preserves all Next.js Server Components, API routes (`app/api/**`), and Clerk/Pusher configurations without requiring any codebase splitting.

If you eventually want to generate a true, offline-capable static export (`next build` with `output: 'export'`), you will need to implement the following changes:

## 1. Move API Routes Out
Static exports do not support Next.js `app/api/**` route handlers. You must either:
- Migrate these to a separate backend (e.g., Express, Node.js server, or cloud functions) and update your API base URL calls.
- Use a monorepo setup where the frontend is static and the backend is a separate service.

## 2. Refactor Server Components
Pages relying on `headers()`, `cookies()`, or `auth()` in Server Components (like `app/(main)/driver/layout.tsx` or `app/(main)/dashboard/page.tsx`) will fail during a static export. 
- You must convert these to **Client Components** and rely on `@clerk/clerk-react` or the Clerk `useAuth()` hook.
- Data fetching must be done client-side (via `useEffect`, React Query, or SWR) instead of natively awaiting fetch in Server Components.

## 3. Implement Sanity Image Loader
Next.js Image Optimization requires a Node.js server to run and cannot be exported statically. You will need to instruct Next.js to offload resizing to Sanity.

**a) Create `lib/sanity-loader.ts`:**
```ts
export default function sanityLoader({ src, width, quality }: { src: string, width: number, quality?: number }) {
  const url = new URL(src);
  if (url.hostname !== 'cdn.sanity.io') return src; // Only process Sanity URLs
  url.searchParams.set('w', width.toString());
  url.searchParams.set('q', (quality || 75).toString());
  url.searchParams.set('auto', 'format');
  return url.href;
}
```

**b) Update `next.config.ts`:**
Conditionally enable static export and the custom loader when building for mobile:
```ts
const isMobileBuild = process.env.MOBILE_BUILD === 'true';

const nextConfig: NextConfig = {
  output: isMobileBuild ? 'export' : undefined,
  images: isMobileBuild ? {
    loader: 'custom',
    loaderFile: './lib/sanity-loader.ts',
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.sanity.io' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'plus.unsplash.com' },
    ],
  } : {
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.sanity.io' },
      // ...
    ]
  },
  // Keep headers, rewrites, and other configs
}
```

## 4. Update Capacitor Config
Remove `server.url` from `capacitor/<app>/capacitor.config.ts`.
Set `webDir` to point directly to the generated Next.js export folder (e.g., `webDir: '../../out'`).
