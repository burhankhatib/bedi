# Unassign driver from orders before deletion (Super Admin)

When a driver asks to be removed from the system, Sanity Studio blocks deletion as long as any **orders** reference that driver. This document describes how to unassign the driver from all orders in one go (and optionally reassign those orders to another driver), then delete the driver in Studio.

## What was added

- **API**: `POST /api/admin/drivers/[id]/unassign-from-orders` (super admin only)
  - Unassigns the driver from every order that references them (clears `assignedDriver`).
  - Optional body: `{ "reassignTo": "<other-driver-id>" }` to assign all those orders to another driver instead of leaving them unassigned.
- **Admin UI**: On the **Admin → Drivers** page, each driver row has an **Unassign from orders** action (user-minus icon). Clicking it opens a modal where you can:
  - Optionally choose **Reassign to** another driver (dropdown).
  - Confirm with **Unassign from all orders** or **Unassign and reassign**.

No changes were made inside Sanity Studio; all logic runs in the Next.js app so Studio remains untouched.

## Instructions: How to remove a driver from the system

1. **Log in as Super Admin** to the app (the same account you use for Admin).
2. Go to **Admin → Drivers** (`/admin/drivers`).
3. Find the driver you want to remove and click the **Unassign from orders** (user-minus) icon next to **Edit**.
4. In the modal:
   - **Optional**: Use **Reassign to** to assign all their orders to another driver. Leave as “— Unassign only —” if you just want to clear the driver from orders.
   - Click **Unassign from all orders** (or **Unassign and reassign** if you picked another driver).
5. Wait for the success message (e.g. “Unassigned from N order(s). You can now delete the driver in Sanity Studio.”).
6. Open **Sanity Studio** (e.g. via **Edit in Studio** for that driver, or your Studio URL).
7. Open the same driver document and **delete** it. Deletion should now succeed because no orders reference that driver.

## Notes

- Only **Super Admin** users can call the unassign API; the Admin Drivers page is already restricted accordingly.
- If you choose **Reassign to** another driver, all orders that referenced the removed driver will now reference the selected driver. Use this for a “default” or replacement driver if you want to keep assignment history consistent.
