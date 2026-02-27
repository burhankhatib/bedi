import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Home, Search, LogIn } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 text-white" dir="ltr">
      <div className="text-center max-w-md">
        <div className="flex justify-center mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.webp" alt="Bedi Delivery" className="h-16 w-auto object-contain" />
        </div>
        <p className="text-8xl font-bold text-slate-800">404</p>
        <h1 className="mt-4 text-2xl font-bold md:text-3xl">Page not found</h1>
        <p className="mt-2 text-slate-400" dir="auto">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <p className="mt-1 text-slate-500 text-sm" dir="auto">
          الصفحة التي تبحث عنها غير موجودة أو تم نقلها.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild className="bg-amber-500 text-slate-950 hover:bg-amber-400" size="lg">
            <Link href="/">
              <Home className="mr-2 size-4" />
              Back to home
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="border-slate-600 bg-slate-800/80 text-white hover:bg-slate-700">
            <Link href="/sign-in">
              <LogIn className="mr-2 size-4" />
              Sign in
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="border-slate-600 bg-slate-800/80 text-white hover:bg-slate-700">
            <Link href="/dashboard">
              <Search className="mr-2 size-4" />
              Dashboard
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
