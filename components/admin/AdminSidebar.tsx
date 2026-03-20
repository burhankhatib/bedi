'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, Shield, FileWarning, Building2, Users, Truck, BarChart3, Layout, ArrowRightLeft, MapPin, Megaphone, Package, Zap, Upload } from 'lucide-react'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'

const nav = [
  { href: '/admin/reports', label: 'Reports', icon: FileWarning },
  { href: '/admin/businesses', label: 'Businesses', icon: Building2 },
  { href: '/admin/import-menu', label: 'Import menu (JSON)', icon: Upload },
  { href: '/admin/catalog', label: 'Product Catalog', icon: Package },
  { href: '/admin/areas', label: 'Platform Areas', icon: MapPin },
  { href: '/admin/seed-subcategories', label: 'Seed Subcategories', icon: Zap },
  { href: '/admin/transfers', label: 'Transfers', icon: ArrowRightLeft },
  { href: '/admin/drivers', label: 'Drivers', icon: Truck },
  { href: '/admin/customers', label: 'Customers', icon: Users },
  { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/admin/broadcast', label: 'Broadcast', icon: Megaphone },
] as const

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  return (
    <>
      {nav.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || (pathname.startsWith(href) && pathname.length > href.length)
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm transition-colors ${
              active ? 'bg-slate-800/80 text-white' : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
            }`}
          >
            <Icon className="size-4 shrink-0" />
            {label}
          </Link>
        )
      })}
      <a
        href="/studio"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-slate-400 transition-colors hover:bg-slate-800/50 hover:text-white"
      >
        <Layout className="size-4 shrink-0" />
        Open Studio
      </a>
    </>
  )
}

export function AdminSidebar() {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Mobile: hamburger + sheet */}
      <div className="flex items-center gap-2 border-b border-slate-800/60 px-4 py-3 md:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-slate-300 hover:text-white" aria-label="Open menu">
              <Menu className="size-6" />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="w-[min(18rem,85vw)] border-slate-800 bg-slate-950 p-0 text-white [&>button]:bg-slate-800 [&>button]:text-white [&>button]:hover:bg-slate-700 [&>button]:ring-offset-slate-950"
          >
            <div className="flex flex-col gap-1 px-3 pt-6 pb-4">
              <div className="flex items-center gap-2 px-3 pb-4">
                <Shield className="size-5 text-amber-400" />
                <span className="font-semibold">Super Admin</span>
              </div>
              <nav className="flex flex-col gap-0.5">
                <NavLinks onNavigate={() => setOpen(false)} />
              </nav>
            </div>
          </SheetContent>
        </Sheet>
        <span className="font-semibold text-white">Super Admin</span>
      </div>

      {/* Desktop: sidebar */}
      <aside className="hidden w-56 shrink-0 border-r border-slate-800/60 py-6 pr-4 md:block">
        <div className="flex items-center gap-2 px-3 pb-4">
          <Shield className="size-5 text-amber-400" />
          <span className="font-semibold">Super Admin</span>
        </div>
        <nav className="space-y-0.5">
          <NavLinks />
        </nav>
      </aside>
    </>
  )
}
