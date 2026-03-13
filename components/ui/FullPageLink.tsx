'use client'

import type { ComponentProps } from 'react'

/**
 * Link that navigates via full page load (window.location) instead of client-side routing.
 * Use for links that cause "removeChild" when using Next.js Link—full page load avoids
 * the React/Radix portal reconciliation race during navigation.
 */
export function FullPageLink({
  href,
  children,
  className,
  ...props
}: Omit<ComponentProps<'a'>, 'href'> & { href: string }) {
  return (
    <a
      href={href}
      className={className}
      {...props}
      onClick={(e) => {
        if (props.onClick) props.onClick(e)
        if (e.defaultPrevented) return
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return
        e.preventDefault()
        window.location.href = href
      }}
    >
      {children}
    </a>
  )
}
