'use client'

import { useEffect, useState } from 'react'
import { type UserViewComponent } from 'sanity/structure'
import { client } from '../lib/client'

type OrderRow = {
  _id: string
  orderNumber?: string
  status?: string
  customerName?: string
  createdAt?: string
  siteName?: string
}

const styles = {
  card: { padding: 16, borderRadius: 8 },
  muted: { color: '#6b7280', fontSize: 12 },
  list: { listStyle: 'none' as const, padding: 0, margin: 0 },
  item: { padding: 12, border: '1px solid #e5e7eb', borderRadius: 6, marginBottom: 8 },
  title: { fontWeight: 600, marginBottom: 4 },
  spinner: { padding: 24, textAlign: 'center' as const },
}

export const OrderHistoryByPhone: UserViewComponent = (props) => {
  const phone = (props.document?.displayed as { primaryPhone?: string } | undefined)?.primaryPhone
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!phone?.trim()) {
        setOrders([])
        setLoading(false)
        return
      }
      setLoading(true)
      client
        .fetch<OrderRow[]>(
          `*[_type == "order" && customerPhone == $phone] | order(createdAt desc) [0...50] {
          _id,
          orderNumber,
          status,
          customerName,
          createdAt,
          "siteName": site->name
        }`,
          { phone: phone.trim() }
        )
        .then((data) => setOrders(Array.isArray(data) ? data : []))
        .catch(() => setOrders([]))
        .finally(() => setLoading(false))
    }, 0)
    return () => clearTimeout(timer)
  }, [phone])

  if (!phone?.trim()) {
    return (
      <div style={styles.card}>
        <p style={{ margin: 0 }}>
          Add <strong>Primary Phone</strong> above to see orders that match this phone number (reference only, not stored on the order).
        </p>
      </div>
    )
  }

  return (
    <div style={{ padding: 16 }}>
      <p style={{ fontWeight: 600, marginTop: 0, marginBottom: 8 }}>
        Order history (by phone — reference only)
      </p>
      <p style={{ ...styles.muted, marginBottom: 16 }}>
        Orders where customer phone matches this number. Not stored as a reference on the order.
      </p>
      {loading ? (
        <div style={styles.spinner}>Loading…</div>
      ) : orders.length === 0 ? (
        <p style={styles.muted}>No orders found with this phone number.</p>
      ) : (
        <ul style={styles.list}>
          {orders.map((o) => (
            <li key={o._id} style={styles.item}>
              <div style={styles.title}>
                #{o.orderNumber ?? o._id}
                {o.siteName ? ` · ${o.siteName}` : ''}
              </div>
              <div style={styles.muted}>
                {o.customerName ?? '—'} · {o.status ?? '—'}
                {o.createdAt ? ` · ${new Date(o.createdAt).toLocaleDateString()}` : ''}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
