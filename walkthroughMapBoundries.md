# GeoJSON City Boundaries — Walkthrough

## What Changed

### 1. City Polygon Boundaries — [geofencing.ts](file:///Users/home/Websites/Zonify/lib/geofencing.ts)

Added **10 new city polygons** to the existing `CITY_POLYGONS` array (Bethany was already present). Each polygon has 20–40 coordinate points tracing the municipal boundary:

| City | Name in Code | Points | Notes |
|------|-------------|--------|-------|
| Bethany | `Bethany` | 54 | Original user-traced polygon (preserved) |
| Jerusalem | `Jerusalem` | 38 | East Jerusalem + neighborhoods (Shufat, Old City, Silwan, Sur Baher…) |
| Ramallah & Al-Bireh | `Ramallah` | 25 | Combined as 1 city per requirement |
| Bethlehem | `Bethlehem` | 25 | Including Beit Jala, Beit Sahour |
| Nablus | `Nablus` | 22 | Valley between Mt. Ebal and Mt. Gerizim |
| Hebron | `Hebron` | 24 | Southern West Bank |
| Gaza | `Gaza` | 24 | Gaza City and surroundings |
| Jenin | `Jenin` | 22 | Northern West Bank |
| Tulkarm | `Tulkarm` | 23 | Northwestern West Bank |
| Qalqilya | `Qalqilya` | 22 | Western West Bank |
| Salfit | `Salfit` | 22 | Central West Bank |

### 2. Geofencing-First Location Detection — [LocationModal.tsx](file:///Users/home/Websites/Zonify/components/global/LocationModal.tsx)

Updated [handleUseCurrentLocation](file:///Users/home/Websites/Zonify/components/global/LocationModal.tsx#43-125) to use a **two-step detection**:
1. **Instant polygon check** via [getCityFromCoordinates()](file:///Users/home/Websites/Zonify/lib/geofencing.ts#447-461) — no API call needed
2. **Nominatim fallback** — only if user is outside all defined polygons

### 3. Reference GeoJSON Files — `data/geojson/`

Generated 11 individual `.geojson` files (one per city) that can be opened directly on [geojson.io](https://geojson.io) for visual editing. Regenerate with:

```bash
npx tsx data/geojson/generate-geojson.ts
```

## Verification

### Coordinate Spot-Checks — **14/14 passed** ✅

```
✅ Bethany center      → "Bethany"
✅ Jerusalem Old City  → "Jerusalem"
✅ Ramallah center     → "Ramallah"
✅ Al-Bireh center     → "Ramallah"     (combined ✓)
✅ Bethlehem center    → "Bethlehem"
✅ Nablus center       → "Nablus"
✅ Hebron center       → "Hebron"
✅ Gaza City center    → "Gaza"
✅ Jenin center        → "Jenin"
✅ Tulkarm center      → "Tulkarm"
✅ Qalqilya center     → "Qalqilya"
✅ Salfit center       → "Salfit"
✅ Tel Aviv (outside)  → null
✅ Amman (outside)     → null
```

### Visual Verification on geojson.io

Bethlehem polygon loaded and verified on geojson.io — correctly covers Bethlehem, Beit Jala, Beit Sahour:

![Bethlehem boundary on geojson.io](/Users/home/.gemini/antigravity/brain/0fb3172d-610f-4cdf-aaf7-e23f15fda275/bethlehem_geojson_verification.png)

### TypeScript Compilation — ✅

`npx tsc --noEmit` passed with no errors.

## Editing Boundaries

To adjust any city boundary:
1. Open the corresponding file from `data/geojson/` on [geojson.io](https://geojson.io)
2. Edit the boundary visually on the map
3. Copy the updated coordinates back into `lib/geofencing.ts`
4. Re-run `npx tsx data/geojson/generate-geojson.ts` to sync reference files
