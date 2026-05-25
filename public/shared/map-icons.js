/**
 * Development work by David Lane
 */
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

  /** Disaster event icons — match Encompass loan marker footprint on unified disasters map */
  const disasterSize = 24;
  const disasterAnchor = 12;
  const disaster = {
    fire: {
      url: svgToDataUri('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#F97316" stroke="#C2410C" stroke-width="1.2" d="M12.7 2.4c.5 3.1-1 4.5-2.4 6.1-1 1.2-1.8 2.5-1.8 4.4 0 2.2 1.8 4 4 4s4-1.8 4-4c0-3.3-2-5.3-3.8-6.8.2 1.7-.5 2.5-1.5 3.4.2-2.3 0-4.4-1.5-7.1z"/></svg>'),
      scaledSize: { width: disasterSize, height: disasterSize },
      anchor: { x: disasterAnchor, y: disasterSize }
    },
    earthquake: {
      url: svgToDataUri('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#9A3412" stroke="#7C2D12" stroke-width="1.2" d="M5 4h14l-4.3 6H18l-4.8 10 .8-7H11l1.6-5H9.7z"/></svg>'),
      scaledSize: { width: disasterSize, height: disasterSize },
      anchor: { x: disasterAnchor, y: disasterSize }
    },
    storm: {
      url: svgToDataUri('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#0EA5E9" stroke="#0369A1" stroke-width="1.2" d="M7 17h9a4 4 0 0 0 .2-8 5.5 5.5 0 0 0-10.7 1A3.5 3.5 0 0 0 7 17z"/><path fill="#F59E0B" d="M12.3 12.2h2L13 15h1.8l-3.1 4 1-2.8h-1.6z"/></svg>'),
      scaledSize: { width: disasterSize, height: disasterSize },
      anchor: { x: disasterAnchor, y: disasterSize }
    },
    flood: {
      url: svgToDataUri('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#0284C7" d="M3 10.5c1.4 0 1.4 1 2.8 1s1.4-1 2.8-1 1.4 1 2.8 1 1.4-1 2.8-1 1.4 1 2.8 1 1.4-1 2.8-1v2.8c-1.4 0-1.4 1-2.8 1s-1.4-1-2.8-1-1.4 1-2.8 1-1.4-1-2.8-1-1.4 1-2.8 1-1.4-1-2.8-1z"/></svg>'),
      scaledSize: { width: disasterSize, height: disasterSize },
      anchor: { x: disasterAnchor, y: disasterSize }
    },
    camera: {
      url: svgToDataUri('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#FFC107" stroke="#F57C00" stroke-width="1" d="M12 15c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zm6-10h-2l-2-2H10L8 5H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2z"/></svg>'),
      scaledSize: { width: disasterSize, height: disasterSize },
      anchor: { x: disasterAnchor, y: disasterSize }
    },
    default: {
      url: svgToDataUri('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#DC2626" stroke="#991B1B" stroke-width="1.2" d="M12 3 2.8 20h18.4z"/><rect x="11" y="8" width="2" height="6" fill="#fff"/><circle cx="12" cy="17" r="1" fill="#fff"/></svg>'),
      scaledSize: { width: disasterSize, height: disasterSize },
      anchor: { x: disasterAnchor, y: disasterSize }
    }
  };

  /** Loan risk icons (Encompass loan points on disasters map) */
  const loanSize = 24;
  const loanAnchor = 12;
  const loan = {
    high: {
      url: svgToDataUri('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#DC2626" stroke="#991B1B" stroke-width="1.2" d="M4 11.5 12 5l8 6.5V20h-5v-5h-6v5H4z"/></svg>'),
      scaledSize: { width: loanSize, height: loanSize },
      anchor: { x: loanAnchor, y: loanSize }
    },
    medium: {
      url: svgToDataUri('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#F59E0B" stroke="#B45309" stroke-width="1.2" d="M4 11.5 12 5l8 6.5V20h-5v-5h-6v5H4z"/></svg>'),
      scaledSize: { width: loanSize, height: loanSize },
      anchor: { x: loanAnchor, y: loanSize }
    },
    low: {
      url: svgToDataUri('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#2563EB" stroke="#1E40AF" stroke-width="1.2" d="M4 11.5 12 5l8 6.5V20h-5v-5h-6v5H4z"/></svg>'),
      scaledSize: { width: loanSize, height: loanSize },
      anchor: { x: loanAnchor, y: loanSize }
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
      scaledSize: new google.maps.Size(c.scaledSize.width, c.scaledSize.height),
      anchor: c.anchor ? new google.maps.Point(c.anchor.x, c.anchor.y) : undefined
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
      scaledSize: new google.maps.Size(c.scaledSize.width, c.scaledSize.height),
      anchor: c.anchor ? new google.maps.Point(c.anchor.x, c.anchor.y) : undefined
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
      scaledSize: new google.maps.Size(c.scaledSize.width, c.scaledSize.height),
      anchor: c.anchor ? new google.maps.Point(c.anchor.x, c.anchor.y) : undefined
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
