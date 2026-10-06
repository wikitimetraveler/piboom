/** Simplified California outline, [lng, lat], clockwise from the Oregon line at the coast. */
export const CALIFORNIA_OUTLINE: [number, number][] = [
  [-124.21, 42.0], [-120.0, 42.0], [-120.0, 39.0], [-114.63, 35.0], [-114.63, 34.87],
  [-114.13, 34.27], [-114.43, 34.08], [-114.53, 33.93], [-114.5, 33.69], [-114.72, 33.41],
  [-114.7, 33.09], [-114.47, 32.84], [-114.72, 32.72], [-117.12, 32.53], [-117.25, 32.7],
  [-117.28, 33.03], [-117.4, 33.2], [-117.6, 33.39], [-117.88, 33.6], [-118.1, 33.74],
  [-118.29, 33.71], [-118.41, 33.77], [-118.39, 33.86], [-118.52, 34.03], [-118.8, 34.0],
  [-119.21, 34.15], [-119.7, 34.4], [-120.47, 34.45], [-120.64, 34.75], [-120.62, 35.15],
  [-120.9, 35.45], [-121.3, 35.66], [-121.9, 36.3], [-121.95, 36.58], [-121.8, 36.8],
  [-122.0, 36.96], [-122.4, 37.2], [-122.51, 37.78], [-122.75, 37.95], [-123.02, 38.0],
  [-123.13, 38.45], [-123.7, 38.92], [-123.83, 39.45], [-123.85, 39.85], [-124.4, 40.44],
  [-124.1, 40.8], [-124.15, 41.4],
];

/** Table origin sits in the San Bernardino Mountains; one scene unit is about one kilometre. */
export const TABLE_ORIGIN = { lat: 34.25, lng: -117.3 };
const KX = 111.32 * Math.cos((TABLE_ORIGIN.lat * Math.PI) / 180);
const KZ = 110.57;

/** North is −z, matching the resort trail map. */
export function tableXZ(lat: number, lng: number): { x: number; z: number } {
  return { x: (lng - TABLE_ORIGIN.lng) * KX, z: -(lat - TABLE_ORIGIN.lat) * KZ };
}

export const FT_TO_KM = 0.0003048;
