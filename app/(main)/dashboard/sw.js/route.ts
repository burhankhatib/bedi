import { promises as fs } from 'node:fs'
import path from 'node:path'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'public', 'app-sw.js')
    const js = await fs.readFile(filePath, 'utf8')
    return new NextResponse(js, {
      headers: {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'public, max-age=0, must-revalidate',
        'Service-Worker-Allowed': '/dashboard',
      },
    })
  } catch {
    return new NextResponse('// Dashboard service worker is unavailable', {
      status: 200,
      headers: {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Service-Worker-Allowed': '/dashboard',
      },
    })
  }
}
