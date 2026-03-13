import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 180
import { auth } from '@clerk/nextjs/server'
import { isSuperAdminEmail } from '@/lib/constants'
import { getEmailForUser } from '@/lib/getClerkEmail'
import { spawn } from 'node:child_process'
import path from 'node:path'

const VALID_MARKET_CATEGORIES = ['grocery', 'bakery', 'retail', 'pharmacy', 'restaurant', 'cafe', 'other'] as const
const BALADI_CATEGORY_PATTERN = /^https?:\/\/(www\.)?baladisupermarket\.com\/categories\/\d+(\/products)?(\?.*)?$/i

async function checkSuperAdmin() {
  const { userId, sessionClaims } = await auth()
  if (!userId) return { ok: false as const, status: 401 }
  let email = ''
  try {
    email = await getEmailForUser(userId, sessionClaims as Record<string, unknown> | null)
  } catch {
    email = (sessionClaims?.email as string) || ''
  }
  if (!isSuperAdminEmail(email)) return { ok: false as const, status: 403 }
  return { ok: true as const }
}

/**
 * POST: Import products from a Baladi category URL (super admin only).
 * Body: { url: string, marketCategory: string }
 * Spawns the import script. May fail if Cloudflare blocks headless scraping.
 */
export async function POST(req: NextRequest) {
  const authResult = await checkSuperAdmin()
  if (!authResult.ok) {
    return NextResponse.json(
      { error: authResult.status === 401 ? 'Unauthorized' : 'Forbidden' },
      { status: authResult.status }
    )
  }

  let body: { url?: string; marketCategory?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const url = typeof body.url === 'string' ? body.url.trim() : ''
  const marketCategory = typeof body.marketCategory === 'string' ? body.marketCategory.trim() : 'grocery'

  if (!url) {
    return NextResponse.json({ error: 'url is required' }, { status: 400 })
  }
  if (!BALADI_CATEGORY_PATTERN.test(url)) {
    return NextResponse.json(
      { error: 'URL must be a Baladi category page, e.g. https://www.baladisupermarket.com/categories/95010/products' },
      { status: 400 }
    )
  }
  if (!VALID_MARKET_CATEGORIES.includes(marketCategory as (typeof VALID_MARKET_CATEGORIES)[number])) {
    return NextResponse.json(
      { error: `marketCategory must be one of: ${VALID_MARKET_CATEGORIES.join(', ')}` },
      { status: 400 }
    )
  }

  return new Promise<NextResponse>((resolve) => {
    const scriptPath = path.join(process.cwd(), 'scripts', 'import-baladi.ts')
    const proc = spawn('npx', ['tsx', scriptPath, '--url', url, '--market-category', marketCategory], {
      cwd: process.cwd(),
      env: { ...process.env, BALADI_HEADLESS: 'true' },
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    const stdout: string[] = []
    const stderr: string[] = []

    proc.stdout?.on('data', (chunk) => stdout.push(chunk.toString()))
    proc.stderr?.on('data', (chunk) => stderr.push(chunk.toString()))

    const timeout = setTimeout(() => {
      proc.kill('SIGTERM')
      resolve(
        NextResponse.json({
          ok: false,
          message: 'Import timed out (max 3 minutes). Cloudflare may be blocking. Try running locally: npx tsx scripts/import-baladi.ts --url "' + url + '" --market-category ' + marketCategory,
          stdout: stdout.join('').slice(-2000),
          stderr: stderr.join('').slice(-1000),
        }, { status: 408 })
      )
    }, 180_000)

    proc.on('close', (code) => {
      clearTimeout(timeout)
      const out = stdout.join('')
      const err = stderr.join('')
      if (code === 0) {
        const createdMatch = out.match(/Created:\s*(\d+)/)
        const updatedMatch = out.match(/Updated:\s*(\d+)/)
        const created = createdMatch ? parseInt(createdMatch[1], 10) : 0
        const updated = updatedMatch ? parseInt(updatedMatch[1], 10) : 0
        resolve(
          NextResponse.json({
            ok: true,
            productsCreated: created,
            productsUpdated: updated,
            message: `Import complete. Created: ${created}, Updated: ${updated}`,
          })
        )
      } else {
        resolve(
          NextResponse.json({
            ok: false,
            message: err || out || 'Import failed. Cloudflare may block headless scraping—run locally with interactive mode.',
            stdout: out.slice(-2000),
            stderr: err.slice(-1000),
          }, { status: 500 })
        )
      }
    })

    proc.on('error', (err) => {
      clearTimeout(timeout)
      resolve(
        NextResponse.json({
          ok: false,
          message: err.message || 'Failed to start import script',
        }, { status: 500 })
      )
    })
  })
}
