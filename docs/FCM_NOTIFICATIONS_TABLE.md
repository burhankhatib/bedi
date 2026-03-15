# FCM / Push Notifications — Full Reference Table

## Summary: What is sent, to whom, and where it links

| Notification | Recipient | Trigger | Link (on click) |
|-------------|-----------|---------|-----------------|
| **Super Admin** | | | |
| New Report | Super Admin | Report created (business/driver/customer → business/driver/customer) | `/admin/reports` |
| New Transfer Request | Super Admin | Tenant submits ownership transfer | `/admin/transfers` |
| Suspended Contact | Super Admin | Suspended user submits contact form | `/admin/reports` |
| New Driver Pending | Super Admin | Driver registers or claims placeholder | `/admin/reports` |
| WhatsApp Inbox | Super Admin | New WhatsApp message (webhook) | `/admin` (default) |
| **Driver** | | | |
| Verification Accepted | Driver | Super Admin verifies driver | `/driver/orders` |
| Welcome (first verification) | Driver | Sanity webhook when driver doc updated & verified | `/driver/orders` |
| New Delivery Order | Online drivers in area | New delivery order needs driver | `/driver/orders` (+ `?goOnline=1`) |
| Go Online Reminder | Offline drivers in area | Orders available, driver is offline | `/driver/orders` |
| Auto-offline (8h) | Driver | Driver online 8+ hours, auto-set offline | `/driver/orders` |
| Morning Encouragement | Driver | Driver goes online during morning (5–11am), once/day | `/driver/orders` |
| **Business / Tenant** | | | |
| New Order | Tenant + staff | New order received | `/t/[slug]/orders` |
| Scheduled Order Reminder | Tenant | Scheduled order ready to prepare | Order-specific |
| Subscription Reminder | Tenant | Subscription expiring in ≤7 days | `/t/[slug]/manage/billing` |
| **Customer** | | | |
| Driver Arrived | Customer | Driver marks "arrived" at delivery | `/t/[slug]/track/[token]` |
| Order Status Updates | Customer | Order status changes | Track link |
| Welcome | Customer | First push subscription | `/` |
| **All Subscribed** | | | |
| Daily Morning Message | All (customer, driver, tenant) | Cron at 7am UTC | `/` |

## Notes

1. **Link behavior**: All links are relative paths. The service worker uses `self.location.origin` to build full URLs, so the app must be opened from the correct domain (e.g. `https://bedi.delivery`). Set `NEXT_PUBLIC_APP_URL` in production.

2. **Super Admin push**: Super Admin must subscribe via the admin push flow (e.g. WhatsApp inbox setup) to receive FCM. Uses `userPushSubscription` with `roleContext: "admin"`.

3. **Driver verification**: Sent from both (a) PATCH verify route when admin verifies, and (b) Sanity webhook when driver doc is updated. `welcomeFcmSent` prevents duplicate from webhook.

4. **Retry delivery requests**: Cron runs every 3 min; re-sends push to online drivers for orders still without driver.
