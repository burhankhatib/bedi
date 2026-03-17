'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import DOMPurify from 'dompurify'
import { marked } from 'marked'

marked.setOptions({ breaks: true, gfm: true })

const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's',
  'ul', 'ol', 'li',
  'h1', 'h2', 'h3', 'h4',
  'blockquote', 'code', 'pre',
  'a',
]
const ALLOWED_ATTR = ['href', 'target', 'rel']

/** Rewrite href for in-app: pathname only. Fixes AI-generated absolute URLs (e.g. example.com).
 * Any URL with path /t/... is treated as in-app and rewritten to relative /t/... */
function rewriteHrefForInApp(href: string, origin?: string): { path: string; inApp: boolean } {
  if (!href?.trim()) return { path: '#', inApp: false }
  const h = href.trim()
  if (h.startsWith('/') && !h.startsWith('//')) return { path: h, inApp: true }
  if (h.startsWith('#')) return { path: h, inApp: false }
  try {
    const u = new URL(h, origin || 'https://bedi.delivery')
    const sameOrigin = !origin || u.origin === origin
    if (sameOrigin) return { path: u.pathname + (u.hash || ''), inApp: true }
    // AI often outputs example.com or wrong domains. Strip domain, keep /t/... paths in-app.
    const path = u.pathname + (u.hash || '')
    if (path.startsWith('/t/')) return { path, inApp: true }
    return { path: h, inApp: false }
  } catch {
    return { path: h, inApp: false }
  }
}

function sanitizeMarkdownSync(md: string, origin?: string): string {
  if (typeof window === 'undefined' || !md?.trim()) return ''
  const html = marked.parse(md.trim(), { async: false }) as string
  let out = DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR })
  if (out.includes('href=')) {
    out = out.replace(/href="([^"]+)"/g, (_, href) => {
      const { path, inApp } = rewriteHrefForInApp(href, origin)
      return inApp ? `href="${path}" data-inapp-link="1"` : `href="${path}"`
    })
  }
  return out
}

interface SanitizedMarkdownProps {
  content: string
  className?: string
  dir?: 'ltr' | 'rtl'
}

/** Renders markdown as sanitized HTML with prose styling. Links stay in-app via client-side navigation. */
export function SanitizedMarkdown({ content, className, dir }: SanitizedMarkdownProps) {
  const [html, setHtml] = useState('')
  const router = useRouter()

  useEffect(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : undefined
    setHtml(sanitizeMarkdownSync(content, origin))
  }, [content])

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const a = (e.target as HTMLElement).closest('a[data-inapp-link="1"]')
      if (a?.getAttribute('href')?.startsWith('/')) {
        e.preventDefault()
        router.push(a.getAttribute('href')!)
      }
    },
    [router]
  )

  if (!html) return <span className="whitespace-pre-wrap">{content}</span>

  return (
    <div
      className={className}
      dir={dir}
      onClick={handleClick}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
