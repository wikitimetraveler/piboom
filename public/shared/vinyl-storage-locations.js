/**
 * Development work by David Lane
 */
/**
 * Physical vinyl shelf locations (zone letter + slot number, e.g. C4).
 * Keep in sync with server validation in controllers/collection.controller.js
 */
(function (global) {
  const STORAGE_ZONES = [
    { code: 'A', label: 'Workbench' },
    { code: 'B', label: 'Bookshelf' },
    { code: 'C', label: 'Console' },
    { code: 'D', label: 'Cooler' },
    { code: 'E', label: 'GarageBox1' },
    { code: 'F', label: 'GarageBox2' },
    { code: 'G', label: 'GarageBox3' },
  ];

  function labelForZone(code) {
    if (!code) return '';
    const c = String(code).toUpperCase();
    const row = STORAGE_ZONES.find((z) => z.code === c);
    return row ? row.label : '';
  }

  function formatStorageDisplay(zone, slot) {
    if (!zone || slot == null || slot === '') return '';
    const z = String(zone).toUpperCase();
    const n = parseInt(slot, 10);
    if (Number.isNaN(n) || n < 1) return '';
    return z + String(n);
  }

  function formatStorageLine(zone, slot) {
    const code = formatStorageDisplay(zone, slot);
    if (!code) return '';
    const lab = labelForZone(zone);
    return lab ? code + ' · ' + lab : code;
  }

  /** Parse "C4" → { zone: 'C', slot: 4 } or null */
  function parseStorageCode(str) {
    if (!str || typeof str !== 'string') return null;
    const m = str.trim().match(/^([A-Ga-g])(\d+)$/);
    if (!m) return null;
    return { zone: m[1].toUpperCase(), slot: parseInt(m[2], 10) };
  }

  const api = {
    STORAGE_ZONES,
    labelForZone,
    formatStorageDisplay,
    formatStorageLine,
    parseStorageCode,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  global.VinylStorageLocations = api;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
