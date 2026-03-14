import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 600
import { auth } from '@clerk/nextjs/server'
import { isSuperAdminEmail } from '@/lib/constants'
import { getEmailForUser } from '@/lib/getClerkEmail'
import { spawn } from 'node:child_process'
import path from 'node:path'

const VALID_MARKET_CATEGORIES = ['grocery', 'bakery', 'retail', 'pharmacy', 'restaurant', 'cafe', 'other'] as const

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
 * POST: Import products from Baladi category IDs (super admin only).
 * Body: { categoryIds: string[], marketCategory: string }
 * Spawns the import script with same functionality as npm run import:baladi:cat.
 * May fail if Cloudflare blocks headless scraping.
 */
export async function POST(req: NextRequest) {
  const authResult = await checkSuperAdmin()
  if (!authResult.ok) {
    return NextResponse.json(
      { error: authResult.status === 401 ? 'Unauthorized' : 'Forbidden' },
      { status: authResult.status }
    )
  }

  let body: { categoryIds?: string | string[]; marketCategory?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const rawIds = body.categoryIds
  const categoryIds = Array.isArray(rawIds)
    ? rawIds.map((s) => String(s).replace(/\D/g, '')).filter(Boolean)
    : typeof rawIds === 'string'
      ? rawIds.split(/[,\s]+/).map((s) => s.replace(/\D/g, '')).filter(Boolean)
      : []
  const marketCategory = typeof body.marketCategory === 'string' ? body.marketCategory.trim() : 'grocery'

  if (categoryIds.length === 0) {
    return NextResponse.json(
      { error: 'categoryIds is required: Baladi category numbers, e.g. 95818, 95010 (comma or space separated)' },
      { status: 400 }
    )
  }
  if (!VALID_MARKET_CATEGORIES.includes(marketCategory as (typeof VALID_MARKET_CATEGORIES)[number])) {
    return NextResponse.json(
      { error: `marketCategory must be one of: ${VALID_MARKET_CATEGORIES.join(', ')}` },
      { status: 400 }
    )
  }

  const categoryIdsArg = categoryIds.join(',')

  return new Promise<NextResponse>((resolve) => {
    const scriptPath = path.join(process.cwd(), 'scripts', 'import-baladi.ts')
    const proc = spawn(
      'npx',
      ['tsx', scriptPath, '--category-ids', categoryIdsArg, '--market-category', marketCategory],
      {
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
          message: `Import timed out (max 10 min). Cloudflare may be blocking. Try locally: npm run import:baladi:cat -- ${categoryIds[0]} ${marketCategory}`,
          stdout: stdout.join('').slice(-2000),
          stderr: stderr.join('').slice(-1000),
        }, { status: 408 })
      )
    }, 480_000)

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
