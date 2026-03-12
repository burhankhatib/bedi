import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * Legacy driver SW endpoint retained for backward compatibility.
 * Chrome rejects redirected SW scripts, so we serve the script content directly.
 */
export async function GET() {
  const script = readFileSync(join(process.cwd(), 'public', 'driver-sw.js'), 'utf-8')
  return new Response(script, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'Service-Worker-Allowed': '/driver/',
    },
  })
}
