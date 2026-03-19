import { NextRequest } from 'next/server'
import { readdir } from 'fs/promises'
import path from 'path'

/** Cache 5 min — frame list changes rarely when editing banner assets */
export const revalidate = 300

const IMAGE_EXT = /\.(jpg|jpeg|png|webp|gif)$/i
/** Extract trailing number before extension (e.g. "burger-001.jpg" → 1, "frame042.png" → 42) */
const NUM_AT_END = /(\d+)(?:\.[^.]+)?$/i

/**
 * GET /api/banners/frames?folder=burger
 * Returns sorted list of frame URLs from /public/banners/{folder}/.
 * Images sorted by number at end of filename (001-0100, any naming).
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const folder = (searchParams.get('folder') ?? 'burger').trim()

  if (!/^[a-z0-9_-]+$/i.test(folder)) {
    return Response.json({ error: 'Invalid folder name' }, { status: 400 })
  }

  const dir = path.join(process.cwd(), 'public', 'banners', folder)

  let entries: string[]
  try {
    entries = await readdir(dir)
  } catch (e) {
    return Response.json(
      { error: 'Folder not found', frames: [] as string[] },
      { status: 404 }
    )
  }

  const frames: { num: number; filename: string }[] = []
  for (const name of entries) {
    if (!IMAGE_EXT.test(name)) continue
    const m = name.match(NUM_AT_END)
    const num = m ? parseInt(m[1]!, 10) : 0
    frames.push({ num, filename: name })
  }
  frames.sort((a, b) => a.num - b.num)

  const urls = frames.map((f) => `/banners/${folder}/${f.filename}`)

  return Response.json({ frames: urls, count: urls.length })
}
