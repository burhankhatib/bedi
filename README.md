# Zonify

Menu & delivery app — order from your zone. Next.js frontend with Sanity CMS, orders, delivery areas, and driver assignment.

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Content is managed in Sanity Studio at [http://localhost:3000/studio](http://localhost:3000/studio).

## Deploy to Vercel

1. **Push to GitHub** (or connect your repo in Vercel).

2. **Import project** in [Vercel](https://vercel.com/new). Select the Zonify repo and leave framework preset as Next.js.

3. **Environment variables** — add in Vercel project → Settings → Environment Variables:
   - `NEXT_PUBLIC_SANITY_PROJECT_ID` — your Sanity project ID
   - `NEXT_PUBLIC_SANITY_DATASET` — e.g. `production`
   - `SANITY_API_TOKEN` — token with write access (for orders, Studio)
   - `SANITY_API_VERSION` — e.g. `2026-01-27` (optional)

4. **Deploy** — Vercel will run `next build`. After deploy:
   - Set admin password in Studio → Restaurant Info
   - Add at least one Delivery Area and one Driver (Captain) in Studio

See **DEPLOYMENT_CHECKLIST.md** for full pre- and post-deploy steps.

## Scripts

- `npm run dev` — development server
- `npm run build` — production build
- `npm run start` — run production build locally
- `npm run deploy` — build and deploy to Vercel (`vercel --prod`)

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Sanity](https://www.sanity.io/docs)
- [Vercel Deployment](https://nextjs.org/docs/app/building-your-application/deploying)
