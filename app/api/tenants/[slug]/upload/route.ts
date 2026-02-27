import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { checkTenantAuth } from '@/lib/tenant-auth'
import type { ClientWithUpload } from '@/lib/sanity-upload'

const MAX_BODY_BYTES = 4 * 1024 * 1024 // 4 MB
const PAYLOAD_TOO_LARGE_MESSAGE = 'Image is too large. Maximum size is 4 MB. Use a smaller image or compress it (e.g. JPEG at 80% quality).'

/** POST: upload a single image file. Body: multipart/form-data with field "file". Returns { _id } (Sanity asset id). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const auth = await checkTenantAuth(slug)
  if (!auth.ok) return NextResponse.json({ error: 'Forbidden' }, { status: auth.status })
  if (!token) return NextResponse.json({ error: 'Server config' }, { status: 500 })

  const contentLength = req.headers.get('content-length')
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_BYTES) {
    return NextResponse.json({ error: PAYLOAD_TOO_LARGE_MESSAGE, code: 'PAYLOAD_TOO_LARGE' }, { status: 413 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file')
    if (!file || typeof file !== 'object' || !('arrayBuffer' in file && typeof (file as Blob).arrayBuffer === 'function')) {
      return NextResponse.json({ error: 'Missing file (field: file)' }, { status: 400 })
    }
    const blob = file as Blob
    const name = 'name' in blob && typeof (blob as File).name === 'string' ? (blob as File).name : 'upload'
    const ext = name.split('.').pop()?.toLowerCase()
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/pjpeg', 'image/png', 'image/webp', 'image/gif']
    const mimeOk = blob.type && (allowedMimes.includes(blob.type) || blob.type.startsWith('image/'))
    const extOk = ext && ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)
    if (!mimeOk && !extOk) {
      return NextResponse.json({ error: 'Invalid type. Use JPEG, PNG, WebP or GIF.' }, { status: 400 })
    }
    const buf = Buffer.from(await blob.arrayBuffer())
    const safeExt = ext && ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext) ? ext : (blob.type?.includes('png') ? 'png' : blob.type?.includes('webp') ? 'webp' : 'jpg')
    const filename = `upload.${safeExt}`

    const writeClient = client.withConfig({ token, useCdn: false })
    const asset = await (writeClient as unknown as ClientWithUpload).assets.upload('image', buf, { filename })
    return NextResponse.json({ _id: asset._id })
  } catch (err) {
    console.error('[upload]', err)
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('body') && (msg.includes('limit') || msg.includes('size') || msg.includes('large') || msg.includes('413'))) {
      return NextResponse.json({ error: PAYLOAD_TOO_LARGE_MESSAGE, code: 'PAYLOAD_TOO_LARGE' }, { status: 413 })
    }
    return NextResponse.json({ error: 'Upload failed. Try a smaller image or a different format (JPEG, PNG, WebP, GIF).' }, { status: 500 })
  }
}
