import os
import re

file_path = "components/tracking/OrderTrackView.tsx"
with open(file_path, "r") as f:
    content = f.read()

# Rename the component
content = re.sub(
    r"export function OrderTrackClient\(\{ slug, token \}: \{ slug: string; token: string \}\)",
    "export function OrderTrackView({ slug, token, orderId, phone }: { slug: string; token?: string; orderId?: string; phone?: string })",
    content
)

# Update fetchTrack logic
fetch_track_old = """  const fetchTrack = useCallback(async (isRefetch = false) => {
    if (!slug || !token?.trim()) return
    if (!isRefetch) {
      setLoading(true)
      setError(null)
    }
    try {
      const res = await fetch(`/api/tenants/${slug}/track/${encodeURIComponent(token)}`, { cache: 'no-store' })"""

fetch_track_new = """  const fetchTrack = useCallback(async (isRefetch = false) => {
    if (!slug) return
    if (!token?.trim() && (!orderId || !phone?.trim())) return
    
    const fetchUrl = token 
      ? `/api/tenants/${slug}/track/${encodeURIComponent(token)}`
      : `/api/tenants/${slug}/order/${orderId}/track?phone=${encodeURIComponent(phone || '')}`
      
    if (!isRefetch) {
      setLoading(true)
      setError(null)
    }
    try {
      const res = await fetch(fetchUrl, { cache: 'no-store' })"""
content = content.replace(fetch_track_old, fetch_track_new)

# Update dependencies array
content = re.sub(
    r"\}, \[slug, token, t\]\)",
    "}, [slug, token, orderId, phone, t])",
    content
)

# Also update the token check in other functions to early return if no token
content = content.replace(
    "if (!token || requestSending) return",
    "if (!token || requestSending) return"
)

# Make sure trackingToken is passed as token or empty
content = content.replace(
    "<CustomerLocationShare orderId={data.order._id} trackingToken={token} />",
    "<CustomerLocationShare orderId={data.order._id} trackingToken={token || ''} />"
)

# Track URL
content = content.replace(
    "const trackUrl = typeof window !== 'undefined' ? `${window.location.origin}/t/${slug}/track/${token}` : ''",
    "const trackUrl = typeof window !== 'undefined' ? (token ? `${window.location.origin}/t/${slug}/track/${token}` : `${window.location.origin}/t/${slug}/order/${orderId}?phone=${encodeURIComponent(phone || '')}`) : ''"
)

with open(file_path, "w") as f:
    f.write(content)
print("Updated OrderTrackView.tsx")
