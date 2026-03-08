import { NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { sendTenantOrderUpdatePush } from '@/lib/tenant-order-push'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    // Validate cron secret if provided in environment
    const authHeader = request.headers.get('authorization')
    if (process.env.CRON_SECRET) {
      if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new NextResponse('Unauthorized', { status: 401 })
      }
    }

    if (!token) {
      console.error('Missing API token for cron job')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const writeClient = client.withConfig({ token, useCdn: false })
    const now = new Date().toISOString()

    // Find orders that are acknowledged, have a notifyAt time that is now or in the past, and haven't had a reminder sent
    const query = `*[_type == "order" && status == "acknowledged" && defined(notifyAt) && notifyAt <= $now && reminderSent != true]{
      _id,
      orderNumber,
      "siteRef": site._ref
    }`
    
    const ordersToRemind = await writeClient.fetch<{ _id: string, orderNumber: string, siteRef: string }[]>(
      query,
      { now }
    )

    console.log(`[cron/scheduled-order-reminders] Found ${ordersToRemind.length} orders to remind.`)

    const results = []

    for (const order of ordersToRemind) {
      try {
        // Send push notification to the business
        await sendTenantOrderUpdatePush({
          orderId: order._id,
          status: 'new', // We use 'new' as a base but override the title and body
          customTitle: 'تذكير بطلب مجدول / Scheduled Order Reminder',
          customBody: 'حان الوقت للبدء في تحضير الطلب المجدول! / It is time to start preparing the scheduled order!',
          baseUrl: process.env.NEXT_PUBLIC_APP_URL,
        })

        // Mark the reminder as sent
        await writeClient.patch(order._id).set({ reminderSent: true }).commit()

        results.push({ orderId: order._id, success: true })
      } catch (err) {
        console.error(`[cron/scheduled-order-reminders] Failed to process order ${order._id}:`, err)
        results.push({ orderId: order._id, success: false, error: String(err) })
      }
    }

    return NextResponse.json({
      success: true,
      processed: ordersToRemind.length,
      results,
    })

  } catch (error) {
    console.error('[cron/scheduled-order-reminders] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
