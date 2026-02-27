import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import type { ClientWithUpload } from '@/lib/sanity-upload'

/** POST: upload a single image (e.g. driver profile picture). Requires sign-in. Returns { _id } (Sanity asset id). */
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!token) return NextResponse.json({ error: 'Server config' }, { status: 500 })

  try {
    const formData = await req.formData()
    const file = formData.get('file')
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file (field: file)' }, { status: 400 })
    }
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowed.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid type. Use JPEG, PNG, WebP or GIF.' }, { status: 400 })
    }
    const buf = Buffer.from(await file.arrayBuffer())
    const ext = file.name.split('.').pop() || 'jpg'
    const filename = `driver-picture.${ext}`

    const writeClient = client.withConfig({ token, useCdn: false })
    const asset = await (writeClient as unknown as ClientWithUpload).assets.upload('image', buf, { filename })
    return NextResponse.json({ _id: asset._id })
  } catch (err) {
    console.error('[driver/upload]', err)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
