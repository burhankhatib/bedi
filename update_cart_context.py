import re
import sys

with open('components/Cart/CartContext.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add ownerId, ownerName to CartItem
content = re.sub(
    r'(export interface CartItem extends Product \{[\s\S]*?)(\n\})',
    r'\1\n  ownerId?: string\n  ownerName?: string\2',
    content
)

# 2. Add deviceId, hostId to CartContextType
content = re.sub(
    r'(interface CartContextType \{[\s\S]*?)(\n  items: CartItem\[\])',
    r'\1\n  deviceId: string | null\n  hostId: string | null\2',
    content
)

# 3. Add imports
if 'import { pusherClient }' not in content:
    content = content.replace(
        "import { useRouter } from 'next/navigation'",
        "import { useRouter } from 'next/navigation'\nimport { pusherClient } from '@/lib/pusher-client'"
    )

# 4. Add deviceId and hostId states
if 'const [deviceId, setDeviceId]' not in content:
    content = re.sub(
        r'(const \[items, setItems\] = useState<CartItem\[\]>\(\[\]\))',
        r'\1\n  const [deviceId, setDeviceId] = useState<string | null>(null)\n  const [hostId, setHostId] = useState<string | null>(null)',
        content
    )

# 5. Provide deviceId and hostId in the context
content = re.sub(
    r'(<CartContext.Provider\s+value=\{\{)',
    r'\1\n        deviceId,\n        hostId,',
    content
)

# 6. Add effects for deviceId and Pusher
effects = """
  useEffect(() => {
    let id = localStorage.getItem('deviceId')
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem('deviceId', id)
    }
    setDeviceId(id)
  }, [])

  useEffect(() => {
    if (orderType === 'dine-in' && tableNumber && cartTenant?.slug && deviceId) {
      const channelName = `tenant-${cartTenant.slug}-table-${tableNumber}-cart`
      
      fetch(`/api/tenants/${cartTenant.slug}/table/${tableNumber}/cart`)
        .then(r => r.json())
        .then(data => {
          if (data && data.items) {
            setItems(data.items)
            setHostId(data.hostId)
          }
        })
        .catch(err => console.error('Failed to fetch shared cart:', err))

      const channel = pusherClient?.subscribe(channelName)
      channel?.bind('cart-updated', (data: any) => {
        setItems(data.items)
        setHostId(data.hostId)
      })

      return () => {
        pusherClient?.unsubscribe(channelName)
      }
    } else {
      setHostId(null)
    }
  }, [orderType, tableNumber, cartTenant?.slug, deviceId])

  const updateItems = useCallback((updater: React.SetStateAction<CartItem[]>) => {
    setItems((prevItems) => {
      const newItems = typeof updater === 'function' ? updater(prevItems) : updater
      
      if (orderType === 'dine-in' && tableNumber && cartTenant?.slug && deviceId) {
         const isHost = hostId === deviceId
         if (isHost) {
           fetch(`/api/tenants/${cartTenant.slug}/table/${tableNumber}/cart`, {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ action: 'host_replace_items', deviceId, items: newItems })
           }).catch(console.error)
         } else {
           const ourItems = newItems.filter(i => !i.ownerId || i.ownerId === deviceId).map(i => ({
             ...i,
             ownerId: deviceId,
             ownerName: customerName || 'Guest'
           }))
           fetch(`/api/tenants/${cartTenant.slug}/table/${tableNumber}/cart`, {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ action: 'update_items', deviceId, ownerName: customerName, items: ourItems })
           }).catch(console.error)
         }
      }
      return newItems
    })
  }, [orderType, tableNumber, cartTenant?.slug, deviceId, hostId, customerName])
"""

if 'crypto.randomUUID()' not in content:
    # insert before doAddItem
    content = content.replace('  const doAddItem = useCallback((', effects + '\n  const doAddItem = useCallback((')

# 7. Replace setItems with updateItems in mutations
# Only in doAddItem, resolveConflictReplace, removeFromCart, updateQuantity, updateNotes, updateAddOns, clearCart
content = content.replace('setItems((prevItems) => {', 'updateItems((prevItems) => {')
content = content.replace('setItems([])', 'updateItems([])')


with open('components/Cart/CartContext.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated CartContext")
