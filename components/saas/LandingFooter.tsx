import Link from 'next/link'

const defaultFooterLinks = [
  { label: 'Product', href: '/#features' },
  { label: 'How it works', href: '/#how-it-works' },
  { label: 'Pricing', href: '/#pricing' },
  { label: 'Sign in', href: '/sign-in' },
  { label: 'Get started', href: '/sign-up' },
]

interface LandingFooterProps {
  links?: { label: string; href: string }[]
  tagline?: string
}

export function LandingFooter({ links = defaultFooterLinks, tagline }: LandingFooterProps) {
  const year = new Date().getFullYear()
  const copy = tagline ?? `© 2026 Bedi Delivery. All rights reserved.`
  return (
    <footer className="border-t border-slate-800/60 bg-slate-950">
      <div className="container mx-auto px-4 py-12">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <Link href="/" className="text-lg font-semibold text-white">
            Bedi Delivery
          </Link>
          <nav className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2">
            {links.map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                className="text-sm text-slate-400 transition-colors hover:text-white"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
        <p className="mt-8 text-center text-xs text-slate-500">
          {copy}
        </p>
      </div>
    </footer>
  )
}
