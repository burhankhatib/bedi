# Pickup Modal for Unsent Item Changes — Enhancement Plan

## Problem

When the driver marks items as "not available" (or makes other edits) but **forgets to click "Send changes to customer for confirmation"**, they can slide to confirm pickup without any warning. Result:

- **Order total stays wrong** — e.g. 75 instead of 55 (unavailable item price not removed)
- **Customer is never notified** — they still see the old total and items
- **Driver and customer totals mismatch** with what was actually collected

## Current Flow (Reference)

| Step | What happens |
|------|--------------|
| 1. Driver edits items | Toggles "not picked", replaces, adds — all in local state `editingItemsByOrder` |
| 2. Driver must click "Send changes to customer" | Calls `saveDriverItemChanges` → PATCH `/api/driver/orders/[orderId]/items` |
| 3. Items API | Saves items, sets `customerItemChangeStatus: 'pending'`, sends FCM `items_changed` to customer |
| 4. Driver slides to pick up | If `customerItemChangeStatus === 'pending'` → show "Confirm customer agreement" modal (Cancel / Yes, customer agreed) |
| 5. If "Yes, customer agreed" | `pickUp(orderId, true)` with `manualCustomerChangeConfirm` → API allows pickup |

**Gap:** If driver never clicks "Send changes to customer", `customerItemChangeStatus` stays non-pending. No modal blocks pickup. Items and total in Sanity are still the old values.

---

## Enhancement: Intercept Pickup When Unsent Changes Affect Total

### 1. Detection: "Unsent changes that affect total"

When driver attempts slide-to-pickup, check:

- `editingItemsByOrder[orderId]` exists and differs from `order.items` in a way that changes the paid total:
  - Any item has `isPicked === false` (not picked)
  - Quantity changed
  - Item replaced or removed
  - Item added

**Helper (pseudocode):**

```ts
function hasUnsentChangesAffectingTotal(order: DriverOrder): boolean {
  const edited = editingItemsByOrder[order.orderId]
  if (!edited?.length) return false
  const server = order.items || []
  // Quick check: different length
  if (edited.length !== server.length) return true
  for (let i = 0; i < edited.length; i++) {
    const e = edited[i]
    const s = server[i]
    if (!s) return true
    if (e.isPicked !== (s.isPicked !== false)) return true
    if ((e.quantity ?? 1) !== (s.quantity ?? 1)) return true
    if ((e.productId || e.productName) !== (s.productId || s.productName)) return true
  }
  return false
}
```

### 2. New Modal: "Unsent item changes"

**When:** Driver completes slide-to-pickup **and** `hasUnsentChangesAffectingTotal(order)` is true.

**Modal content (Arabic primary):**

- **Title:** "تغييرات الأصناف لم تُرسل للعميل" / "Item changes not sent to customer"
- **Body:** "قمت بتحديد أصنافاً غير متوفرة أو غيرت الطلب. المجموع تغيّر (مثلاً 55 بدلاً من 75). أرسل التغييرات للعميل أو أكّد أنك اتّفقت معه هاتفياً."
  - EN: "You marked items as not available or changed the order. The total has changed (e.g. 55 instead of 75). Send these changes to the customer or confirm you agreed with them by phone."

**Actions:**

| Button | Action |
|--------|--------|
| **إرسال التغييرات للعميل** / "Send changes to customer" | Call `saveDriverItemChanges(order)`. Close modal. Toast: "Changes sent. Wait for customer confirmation or confirm by phone." After that, `customerItemChangeStatus` becomes `pending`. If driver slides again, they get the existing "Confirm customer agreement" modal. |
| **تأكدت مع العميل هاتفياً** / "I confirmed with customer by phone" | 1) Save items via PATCH with `manualCustomerConfirm: true` (new param). 2) Call `pickUp(orderId, true)`. Close modal. Proceed with pickup. New total is applied; customer gets a lightweight notification that the order was updated. |
| **إلغاء** / "Cancel" | Close modal. Slide resets. |

### 3. API: Items PATCH with `manualCustomerConfirm`

**Endpoint:** `PATCH /api/driver/orders/[orderId]/items`

**New optional body field:** `manualCustomerConfirm?: boolean`

**When `manualCustomerConfirm === true`:**

- Save items (same logic as today)
- Set `customerItemChangeStatus: 'approved'`
- Set `customerItemChangeResolvedAt: now`
- Set `customerItemChangeResponseNote: 'تم التأكيد هاتفياً'` (or similar)
- **Do NOT** set `customerItemChangeStatus: 'pending'`
- **Do NOT** send FCM `items_changed` to customer (they already agreed by phone)
- **Do** send a lightweight FCM to customer: e.g. "تم تحديث طلبك — المجموع الجديد: X" (Order updated — new total: X)
- Return success

This ensures the order document has the correct `subtotal`, `totalAmount`, and `items` before pickup.

### 4. Pickup API

No change. Already accepts `manualCustomerChangeConfirm`. When driver calls pickup after "I confirmed by phone", we first save items (with `manualCustomerConfirm`), then call pickup. The order will have `customerItemChangeStatus: 'approved'`, so the pickup API’s existing check (`customerItemChangeStatus === 'pending'`) will pass.

### 5. Order Journey Summary

```
Driver at business
    │
    ├─► Driver edits items (mark not picked, etc.) → local state
    │
    ├─► Driver slides to pick up
    │       │
    │       ├─► Has unsent changes affecting total?
    │       │       YES → Show "Unsent changes" modal
    │       │             ├─► "Send to customer" → save, set pending, toast
    │       │             ├─► "Confirmed by phone" → save with manualCustomerConfirm, then pickup
    │       │             └─► "Cancel" → close
    │       │
    │       └─► customerItemChangeStatus === 'pending'?
    │               YES → Show "Confirm customer agreement" modal
    │                     ├─► "Yes, customer agreed" → pickup with manualCustomerChangeConfirm
    │                     └─► "Cancel" → close
    │
    └─► No blocking conditions → pickup proceeds
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `app/api/driver/orders/[orderId]/items/route.ts` | Add `manualCustomerConfirm` body param. When true: save items, set `approved`, resolve, skip pending FCM, optionally send "order updated" FCM to customer. |
| `app/(main)/driver/orders/DriverOrdersV2.tsx` | Add `hasUnsentChangesAffectingTotal(order)` helper. Intercept `pickUp` when true → show new modal. Implement "Send to customer" and "Confirmed by phone" actions. |
| `lib/customer-order-push.ts` | Optionally add `order_total_updated` status for the "confirmed by phone" case, so customer gets "Your order total was updated to X." |

---

## Edge Cases

| Case | Handling |
|------|----------|
| Driver has unsent changes but they don't affect total | E.g. only changed `notPickedReason` text. Don't block pickup. (Optional: still show a softer reminder.) |
| Driver confirmed by phone, then customer opens app | Customer sees updated total and items. Status is `approved` so no pending approval UI. |
| Items API fails on "confirmed by phone" | Don't call pickup. Show error toast. Keep modal open or allow retry. |
| Multiple devices | `editingItemsByOrder` is local state. If driver switches devices, we only have server state. No cross-device sync of unsent edits. |

---

## Customer FCM on "Confirmed by Phone"

When driver saves with `manualCustomerConfirm: true`, customer should be informed:

- **Title (ar):** "تم تحديث طلبك"
- **Body (ar):** "السائق أكّد التغييرات هاتفياً. المجموع الجديد: X [currency]."
- **URL:** Track page

Use existing `sendCustomerOrderStatusPush` with a new status (e.g. `order_total_updated`) or extend `items_changed` with a variant. Prefer a dedicated status for clarity.

---

## Implementation Order

1. Add `manualCustomerConfirm` to items PATCH API and implement save + approve flow.
2. Add `hasUnsentChangesAffectingTotal` helper in DriverOrdersV2.
3. Intercept `onPickUp` / slide completion: when unsent changes, show new modal instead of calling `pickUp`.
4. Wire modal buttons: "Send to customer" → `saveDriverItemChanges`; "Confirmed by phone" → items PATCH with `manualCustomerConfirm` + `pickUp(orderId, true)`.
5. Add customer FCM for "order total updated" (optional, can be phase 2).
6. Test: edit items, don't save, slide to pickup → modal. Test both modal paths.
