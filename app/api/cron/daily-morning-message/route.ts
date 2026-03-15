import { NextResponse } from 'next/server'
import { broadcastToAllSubscribers } from '@/lib/broadcast-push'

export const dynamic = 'force-dynamic'

/** Daily morning message to all subscribed users (customer, driver, tenant). Runs at 7am UTC. */
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { sent, failed } = await broadcastToAllSubscribers({
      title: 'صَبَاحُ الخَيْر! ☀️',
      body: 'نتمنى لك يوماً سعيداً. اطلب طعامك المفضل أو استقبل طلبات التوصيل - نحن معك.',
      url: '/',
      dir: 'rtl',
    })
    return NextResponse.json({ ok: true, sent, failed })
  } catch (error: unknown) {
    console.error('[cron/daily-morning-message]', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
