/**
 * Central map marker icon definitions for Google Maps.
 * Uses Data URI SVGs for no external requests and easy theming.
 * @see docs/FRONTEND_PATTERNS.md
 */
(function (global) {
  'use strict';

  const SIZE = 32;
  const ANCHOR = 16;

  function svgToDataUri(svg) {
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
  }

  /** Collection icons (32x32) */
  const collection = {
    bike: {
      url: 'https://maps.google.com/mapfiles/kml/shapes/cycling.png',
      scaledSize: { width: SIZE, height: SIZE },
      anchor: { x: ANCHOR, y: SIZE }
    },
    fish: {
      url: 'https://maps.google.com/mapfiles/kml/shapes/fishing.png',
      scaledSize: { width: SIZE, height: SIZE },
      anchor: { x: ANCHOR, y: SIZE }
    },
    tree: {
      url: svgToDataUri('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#228B22" stroke="#1B5E20" stroke-width="1" d="M12 2L22 20H14v4H10v-4H2L12 2z"/></svg>'),
      scaledSize: { width: SIZE, height: SIZE },
      anchor: { x: ANCHOR, y: SIZE }
    },
    critter: {
      url: svgToDataUri('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#8BC34A" stroke="#2E7D32" stroke-width="1.5" d="M12 2c-2 0-3.5 1.5-3.5 3.5 0 1.5 1 2.5 2 3-1.5.5-2.5 2-2.5 3.5 0 2 1.5 3.5 3.5 3.5s3.5-1.5 3.5-3.5c0-1.5-1-3-2.5-3.5 1-.5 2-1.5 2-3C15.5 3.5 14 2 12 2z"/></svg>'),
      scaledSize: { width: SIZE, height: SIZE },
      anchor: { x: ANCHOR, y: SIZE }
    }
  };

  /** Disaster/loan event icons (24x24 to match loan dot size) */
  const disasterSize = 24;
  const disasterAnchor = 15;
  const disaster = {
    fire: {
      url: 'https://maps.google.com/mapfiles/ms/icons/fire.png',
      scaledSize: { width: disasterSize, height: disasterSize },
      anchor: { x: disasterAnchor, y: disasterSize }
    },
    earthquake: {
      url: 'https://maps.google.com/mapfiles/ms/icons/earthquake.png',
      scaledSize: { width: disasterSize, height: disasterSize },
      anchor: { x: disasterAnchor, y: disasterSize }
    },
    storm: {
      url: 'https://maps.google.com/mapfiles/ms/icons/storm.png',
      scaledSize: { width: disasterSize, height: disasterSize },
      anchor: { x: disasterAnchor, y: disasterSize }
    },
    flood: {
      url: svgToDataUri('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#2196F3" stroke="#1565C0" stroke-width="1" d="M12 2L4 10h3v4H4l8 8 8-8h-3v-4h3L12 2z"/></svg>'),
      scaledSize: { width: disasterSize, height: disasterSize },
      anchor: { x: disasterAnchor, y: disasterSize }
    },
    camera: {
      url: svgToDataUri('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#FFC107" stroke="#F57C00" stroke-width="1" d="M12 15c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zm6-10h-2l-2-2H10L8 5H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2z"/></svg>'),
      scaledSize: { width: disasterSize, height: disasterSize },
      anchor: { x: disasterAnchor, y: disasterSize }
    },
    default: {
      url: svgToDataUri('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#E53935" stroke="#B71C1C" stroke-width="2"/></svg>'),
      scaledSize: { width: disasterSize, height: disasterSize },
      anchor: { x: disasterAnchor, y: disasterSize }
    }
  };

  /** Loan risk icons (30x30) */
  const loan = {
    high: {
      url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
      scaledSize: { width: disasterSize, height: disasterSize },
      anchor: { x: disasterAnchor, y: disasterSize }
    },
    medium: {
      url: 'https://maps.google.com/mapfiles/ms/icons/yellow-dot.png',
      scaledSize: { width: disasterSize, height: disasterSize },
      anchor: { x: disasterAnchor, y: disasterSize }
    },
    low: {
      url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png',
      scaledSize: { width: disasterSize, height: disasterSize },
      anchor: { x: disasterAnchor, y: disasterSize }
    }
  };

  /**
   * Get disaster icon config by event_type/source.
   * @param {string} eventType - e.g. 'earthquake', 'wildfire', 'fire'
   * @param {string} source - e.g. 'usgs', 'firms', 'nws', 'fema', 'alertcalifornia'
   * @returns {object} Google Maps icon config
   */
  function getDisasterIcon(eventType, source) {
    const et = (eventType || '').toLowerCase();
    const src = (source || '').toLowerCase();
    if (et === 'camera' || src === 'alertcalifornia') return disaster.camera;
    if (et.includes('fire') || et.includes('wildfire') || src === 'firms') return disaster.fire;
    if (et.includes('earthquake') || et.includes('quake') || src === 'usgs') return disaster.earthquake;
    if (et.includes('storm') || et.includes('hurricane') || et.includes('tornado') || et.includes('wind') || src === 'nws' || src === 'nhc') return disaster.storm;
    if (et.includes('flood') || et.includes('water')) return disaster.flood;
    return disaster.default;
  }

  /**
   * Get loan icon config by risk score.
   * @param {number} score - disaster_risk_score
   * @returns {object} Google Maps icon config
   */
  function getLoanIcon(score) {
    if (!score && score !== 0) return loan.low;
    if (score >= 7) return loan.high;
    if (score >= 4) return loan.medium;
    return loan.low;
  }

  /**
   * Get disaster icon ready for Google Maps Marker (requires google.maps loaded).
   */
  function getDisasterIconForMarker(eventType, source) {
    const c = getDisasterIcon(eventType, source);
    if (typeof google === 'undefined' || !google.maps) return { url: c.url };
    return {
      url: c.url,
      scaledSize: new google.maps.Size(c.scaledSize.width, c.scaledSize.height)
    };
  }

  /**
   * Get loan icon ready for Google Maps Marker (requires google.maps loaded).
   * @param {number} score - disaster_risk_score
   */
  function getLoanIconForMarker(score) {
    const c = getLoanIcon(score);
    if (typeof google === 'undefined' || !google.maps) return { url: c.url };
    return {
      url: c.url,
      scaledSize: new google.maps.Size(c.scaledSize.width, c.scaledSize.height)
    };
  }

  /**
   * Get loan icon by flood zone (for pipeline-risk-dashboard).
   * @param {string} floodZone - e.g. 'A', 'V', 'X'
   * @param {string} floodZoneType - e.g. 'Shaded'
   */
  function getLoanIconByFloodZoneForMarker(floodZone, floodZoneType) {
    let c = loan.low;
    if (floodZone) {
      const fz = floodZone.toUpperCase();
      if (fz.startsWith('A') || fz.startsWith('V')) c = loan.high;
      else if (fz.includes('X') && floodZoneType && String(floodZoneType).includes('Shaded')) c = loan.medium;
    }
    if (typeof google === 'undefined' || !google.maps) return { url: c.url };
    return {
      url: c.url,
      scaledSize: new google.maps.Size(c.scaledSize.width, c.scaledSize.height)
    };
  }

  /**
   * Get collection icon ready for Google Maps Marker (requires google.maps loaded).
   */
  function getCollectionIconForMarker(name) {
    const c = collection[name];
    if (!c) return null;
    if (typeof google === 'undefined' || !google.maps) return { url: c.url };
    return {
      url: c.url,
      scaledSize: new google.maps.Size(c.scaledSize.width, c.scaledSize.height),
      anchor: c.anchor ? new google.maps.Point(c.anchor.x, c.anchor.y) : undefined
    };
  }

  global.mapIcons = {
    collection,
    disaster,
    loan,
    getDisasterIcon,
    getLoanIcon,
    getDisasterIconForMarker,
    getLoanIconForMarker,
    getLoanIconByFloodZoneForMarker,
    getCollectionIconForMarker,
    SIZE,
    ANCHOR
  };
})(typeof window !== 'undefined' ? window : globalThis);
