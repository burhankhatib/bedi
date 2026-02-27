'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import { Mail, Send, Home, AlertCircle } from 'lucide-react'

type SuspendedType = 'business' | 'driver' | 'customer'

const COPY: Record<SuspendedType, { title: string; subtitle: string; who: string }> = {
  business: {
    title: 'This business account has been suspended',
    subtitle: 'This business is currently unable to receive orders or access the control panel. If you believe this was done in error or you are the owner of this business, please reach out to us using the form below. We’re sorry for any inconvenience.',
    who: 'business owner',
  },
  driver: {
    title: 'This driver account has been suspended',
    subtitle: 'This driver account is currently unable to accept or complete deliveries. If you are the owner of this account and would like to discuss this, please get in touch with us using the form below. We’re sorry for any inconvenience.',
    who: 'driver',
  },
  customer: {
    title: 'This customer account has been suspended',
    subtitle: 'This account is currently unable to place orders. If you are the account holder and would like to appeal or clarify, please reach out to us using the form below. We’re sorry for any inconvenience.',
    who: 'customer',
  },
}

export function SuspendedClient({ type }: { type: SuspendedType }) {
  const { userId } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const text = COPY[type]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSending(true)
    try {
      const res = await fetch('/api/suspended/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, name, email, message, clerkUserId: userId ?? undefined }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError((data.error as string) || 'Failed to send. Please try again.')
        return
      }
      setSent(true)
      setName('')
      setEmail('')
      setMessage('')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="relative w-32 h-32 flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.webp"
              alt="Bedi Delivery"
              className="h-24 w-auto object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
                const fallback = e.currentTarget.nextElementSibling
                if (fallback instanceof HTMLElement) fallback.classList.remove('hidden')
              }}
            />
            <span className="hidden text-2xl font-bold text-amber-400" aria-hidden="true">Bedi</span>
          </div>
        </div>

        {/* Message card */}
        <div className="rounded-3xl border border-slate-700/60 bg-slate-800/40 shadow-xl overflow-hidden">
          <div className="p-6 md:p-8 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-400 mb-6">
              <AlertCircle className="w-7 h-7" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-white">{text.title}</h1>
            <p className="mt-4 text-slate-300 leading-relaxed">{text.subtitle}</p>
          </div>

          {/* Contact form */}
          <div className="border-t border-slate-700/60 bg-slate-900/40 p-6 md:p-8">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Reach out to us
            </h2>
            {sent ? (
              <p className="text-emerald-400 font-medium">Thank you. We’ve received your message and will get back to you as soon as we can.</p>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="suspended-name" className="block text-sm font-medium text-slate-400 mb-1">Name</label>
                  <input
                    id="suspended-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-xl border border-slate-600 bg-slate-800/80 px-4 py-3 text-white placeholder-slate-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                    placeholder="Your name"
                    maxLength={200}
                  />
                </div>
                <div>
                  <label htmlFor="suspended-email" className="block text-sm font-medium text-slate-400 mb-1">Email *</label>
                  <input
                    id="suspended-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-600 bg-slate-800/80 px-4 py-3 text-white placeholder-slate-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                    placeholder="you@example.com"
                    maxLength={320}
                  />
                </div>
                <div>
                  <label htmlFor="suspended-message" className="block text-sm font-medium text-slate-400 mb-1">Message</label>
                  <textarea
                    id="suspended-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={4}
                    className="w-full rounded-xl border border-slate-600 bg-slate-800/80 px-4 py-3 text-white placeholder-slate-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50 resize-none"
                    placeholder="Tell us about your account and how we can help..."
                    maxLength={2000}
                  />
                </div>
                {error && <p className="text-sm text-rose-400">{error}</p>}
                <Button
                  type="submit"
                  disabled={sending}
                  className="w-full rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold py-3"
                >
                  {sending ? 'Sending…' : (<><Send className="w-4 h-4 mr-2" /> Send message</>)}
                </Button>
              </form>
            )}
          </div>
        </div>

        <div className="mt-8 flex justify-center">
          <Button asChild variant="outline" size="lg" className="rounded-xl border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white">
            <Link href="/">
              <Home className="w-4 h-4 mr-2" />
              Back to home
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
