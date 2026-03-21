import re

# Update app/api/orders/status/route.ts
path1 = 'app/api/orders/status/route.ts'
with open(path1, 'r', encoding='utf-8') as f:
    content1 = f.read()

content1 = content1.replace(
    '"prioritizeWhatsapp": site->prioritizeWhatsapp',
    '"tenantSlug": site->slug.current,\n      "prioritizeWhatsapp": site->prioritizeWhatsapp'
)

clear_redis_code1 = """    if (status === 'completed' || status === 'served') {
      await cancelOrderJobs(orderId)
      if (existingOrder.orderType === 'dine-in' && existingOrder.tableNumber && existingOrder.tenantSlug) {
        try {
          const { redis } = await import('@/lib/redis')
          if (redis) {
            await redis.del(`cart:${existingOrder.tenantSlug}:${existingOrder.tableNumber}`)
          }
        } catch (e) {
          console.error('Failed to clear Redis cart:', e)
        }
      }
    }"""

content1 = content1.replace(
"""    if (status === 'completed' || status === 'served') {
      await cancelOrderJobs(orderId)
    }""",
    clear_redis_code1
)

with open(path1, 'w', encoding='utf-8') as f:
    f.write(content1)
print(f"Updated {path1}")


# Update app/api/tenants/[slug]/orders/status/route.ts
path2 = 'app/api/tenants/[slug]/orders/status/route.ts'
with open(path2, 'r', encoding='utf-8') as f:
    content2 = f.read()

content2 = content2.replace(
    "`*[_type == \"order\" && _id == $orderId][0]{ assignedDriver, scheduledFor, \"prioritizeWhatsapp\": site->prioritizeWhatsapp }`",
    "`*[_type == \"order\" && _id == $orderId][0]{ assignedDriver, scheduledFor, \"prioritizeWhatsapp\": site->prioritizeWhatsapp, orderType, tableNumber }`"
)

clear_redis_code2 = """    if (status === 'completed' || status === 'served') {
      await cancelOrderJobs(orderId)
      if (orderBefore?.orderType === 'dine-in' && orderBefore?.tableNumber && slug) {
        try {
          const { redis } = await import('@/lib/redis')
          if (redis) {
            await redis.del(`cart:${slug}:${orderBefore.tableNumber}`)
          }
        } catch (e) {
          console.error('[tenant/orders/status] Failed to clear Redis cart:', e)
        }
      }
    }"""

content2 = content2.replace(
"""    if (status === 'completed' || status === 'served') {
      await cancelOrderJobs(orderId)
    }""",
    clear_redis_code2
)

with open(path2, 'w', encoding='utf-8') as f:
    f.write(content2)
print(f"Updated {path2}")
