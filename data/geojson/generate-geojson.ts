/**
 * Generate reference GeoJSON files from CITY_POLYGONS.
 * Run: npx tsx data/geojson/generate-geojson.ts
 */
import { CITY_POLYGONS } from '../../lib/geofencing';
import { writeFileSync } from 'fs';
import { join } from 'path';

const dir = __dirname;

for (const city of CITY_POLYGONS) {
  const geojson = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { name: city.name },
        geometry: {
          coordinates: city.coordinates,
          type: 'LineString',
        },
      },
    ],
  };

  const filename = city.name.toLowerCase().replace(/\s+/g, '-') + '.geojson';
  writeFileSync(join(dir, filename), JSON.stringify(geojson, null, 2) + '\n');
  console.log(`✅ ${filename}`);
}

console.log(`\nGenerated ${CITY_POLYGONS.length} GeoJSON files in ${dir}`);
