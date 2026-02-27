/** Used when passing Sanity client to uploadImageFromUrl (Sanity client is compatible at runtime). */
export type ClientWithUpload = {
  assets: { upload: (type: string, body: Buffer, opts: { filename: string }) => Promise<{ _id: string }> }
}

export async function uploadImageFromUrl(
  client: ClientWithUpload,
  url: string
): Promise<string | null> {
  try {
    const res = await fetch(url, { next: { revalidate: 0 } })
    if (!res.ok) return null
    const buf = await res.arrayBuffer()
    const contentType = res.headers.get('content-type') || 'image/jpeg'
    const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg'
    const asset = await client.assets.upload('image', Buffer.from(buf), {
      filename: `product.${ext}`,
    })
    return asset._id
  } catch {
    return null
  }
}
