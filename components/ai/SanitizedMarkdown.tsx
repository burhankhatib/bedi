'use client'

import { useEffect, useState } from 'react'
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

function sanitizeMarkdownSync(md: string): string {
  if (typeof window === 'undefined' || !md?.trim()) return ''
  const html = marked.parse(md.trim(), { async: false }) as string
  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR })
}

interface SanitizedMarkdownProps {
  content: string
  className?: string
  dir?: 'ltr' | 'rtl'
}

/** Renders markdown as sanitized HTML with prose styling. */
export function SanitizedMarkdown({ content, className, dir }: SanitizedMarkdownProps) {
  const [html, setHtml] = useState('')

  useEffect(() => {
    setHtml(sanitizeMarkdownSync(content))
  }, [content])

  if (!html) return <span className="whitespace-pre-wrap">{content}</span>

  return (
    <div
      className={className}
      dir={dir}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
