'use client'

import { useMemo, useState } from 'react'
import { LUCIDE_ALL_KEYS_SORTED } from '@/lib/lucide-all-keys-sorted'
import { LucideKebabIcon } from '@/components/icons/LucideKebabIcon'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { normalizeLucideIconKey } from '@/lib/lucide-icon-valid'

type Props = {
  value: string
  onChange: (kebabKey: string) => void
  disabled?: boolean
}

export function LucideIconPicker({ value, onChange, disabled }: Props) {
  const [q, setQ] = useState('')
  const normalizedValue = normalizeLucideIconKey(value) ?? ''

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase().replace(/\s+/g, '-')
    if (!n) return [...LUCIDE_ALL_KEYS_SORTED].slice(0, 72)
    const hits: string[] = []
    for (const k of LUCIDE_ALL_KEYS_SORTED) {
      if (k.includes(n)) {
        hits.push(k)
        if (hits.length >= 144) break
      }
    }
    return hits
  }, [q])

  return (
    <div className="space-y-2">
      <label className="block text-xs text-slate-400">
        Lucide icon{' '}
        <a
          href="https://lucide.dev/icons/"
          target="_blank"
          rel="noreferrer"
          className="text-sky-400 underline-offset-2 hover:underline"
        >
          (browse)
        </a>
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search: pizza, fish, heart…"
          disabled={disabled}
          className="flex-1 border-slate-600 bg-slate-800 font-mono text-sm text-white placeholder:text-slate-600"
        />
        <div className="flex size-12 shrink-0 items-center justify-center rounded-lg border border-slate-600 bg-slate-950">
          <LucideKebabIcon name={normalizedValue || value} className="text-amber-300" size={28} strokeWidth={1.5} />
        </div>
      </div>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value.trim().toLowerCase().replace(/\s+/g, '-'))}
        placeholder="Selected key (kebab-case)"
        disabled={disabled}
        className="border-slate-600 bg-slate-950 font-mono text-xs text-emerald-200"
      />
      {value && !normalizeLucideIconKey(value) ? (
        <p className="text-xs text-rose-300">Unknown icon key for this Lucide version — pick from search results.</p>
      ) : null}
      <div className="max-h-52 overflow-y-auto rounded-lg border border-slate-700 bg-slate-950/80 p-2">
        <div className="grid grid-cols-6 gap-1 sm:grid-cols-8">
          {filtered.map((key) => {
            const active = normalizeLucideIconKey(value) === key
            return (
              <button
                key={key}
                type="button"
                disabled={disabled}
                title={key}
                onClick={() => {
                  onChange(key)
                  setQ('')
                }}
                className={`flex aspect-square items-center justify-center rounded-md border transition-colors ${
                  active
                    ? 'border-amber-500 bg-amber-500/20'
                    : 'border-transparent bg-slate-800/80 hover:border-slate-500 hover:bg-slate-800'
                }`}
              >
                <LucideKebabIcon name={key} className="text-slate-200" size={22} strokeWidth={1.5} />
              </button>
            )
          })}
        </div>
        {filtered.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-slate-500">No matches — try another term.</p>
        ) : null}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs text-slate-400"
        disabled={disabled}
        onClick={() => onChange('')}
      >
        Clear key (save will assign default)
      </Button>
    </div>
  )
}
