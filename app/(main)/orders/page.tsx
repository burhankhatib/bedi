import { client } from '@/sanity/lib/client'
import { ORDERS_QUERY, NEW_ORDERS_QUERY } from '@/sanity/lib/queries'
import { OrdersClient } from './OrdersClient'
import { OrderNotificationsWrapper } from './OrderNotificationsWrapper'

// Force dynamic rendering to ensure SanityLive works
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function OrdersPage() {
  let orders = []
  let newOrders: Array<{ _id: string; orderNumber: string; createdAt: string }> = []

  try {
    const [ordersResult, newOrdersResult] = await Promise.all([
      client.fetch(ORDERS_QUERY),
      client.fetch(NEW_ORDERS_QUERY),
    ])
    orders = (ordersResult ?? []) as any[]
    newOrders = (newOrdersResult ?? []) as Array<{ _id: string; orderNumber: string; createdAt: string }>

    console.log('[Orders Page] Fetched orders:', {
      totalOrders: orders.length,
      newOrdersCount: newOrders.length,
      newOrders: newOrders.map(o => ({ id: o._id, orderNumber: o.orderNumber }))
    })
  } catch (error) {
    console.error('[Orders] Failed to fetch orders:', error)
    orders = []
    newOrders = []
  }

  return (
    <>
      <OrdersClient initialOrders={orders} />
      <OrderNotificationsWrapper initialNewOrders={newOrders} />
    </>
  )
}
