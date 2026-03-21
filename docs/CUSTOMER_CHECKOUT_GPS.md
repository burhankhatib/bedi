# Customer checkout — delivery map & GPS

## Behavior

- **Share My Location** (first step): fast GPS fix (`enableHighAccuracy: false`, `maximumAge: 0`, ~18s timeout).
- **Map FAB (emerald, Locate icon)**: same as refresh — updates the pin from GPS.
- **Crosshair (white, bottom-right)**: only **centers the map on the draggable pin**; does not call GPS.
- **Refresh location** / **Improve accuracy** (below map): re-run GPS; **Improve accuracy** uses high accuracy + longer timeout.
- Choosing **Delivery** no longer auto-starts GPS (avoids racing a second `getCurrentPosition` with the share button).

## Code

- `components/Cart/UnifiedOrderDialog.tsx` — `requestDeliveryLocation`, `geoInFlightRef`
- `components/Cart/LocationPickerMap.tsx` — map FAB + center-on-pin
