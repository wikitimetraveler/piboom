/** Pure disaster → mood track mapping (shared by browser player and unit tests). */

export const MUTE_STORAGE_KEY = 'dc_disaster_music_muted';

export const TRACK_RELATIVE_PATHS = {
  fire: 'disasters/fire.mp3',
  flood: 'disasters/flood.mp3',
  hurricane: 'disasters/hurricane.mp3',
  earthquake: 'disasters/earthquake.mp3',
  storm: 'disasters/storm.mp3',
  default: 'disasters/default.mp3',
};

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .trim();
}

function disasterTextBlob(disaster) {
  if (!disaster || typeof disaster !== 'object') return '';
  return [
    disaster.source,
    disaster.event_type,
    disaster.eventType,
    disaster.incidentType,
    disaster.incident_type,
    disaster.title,
    disaster.declarationTitle,
    disaster.declaration_title,
  ]
    .map(normalizeText)
    .filter(Boolean)
    .join(' ');
}

/**
 * Map a disaster record to a mood key and relative music path under musicDir.
 * @returns {{ mood: string, relativePath: string }}
 */
export function resolveTrack(disaster) {
  const source = normalizeText(disaster?.source);
  const blob = disasterTextBlob(disaster);

  if (
    source === 'firms' ||
    source === 'alertcalifornia' ||
    /\b(fire|wildfire|burn|smoke)\b/.test(blob)
  ) {
    return { mood: 'fire', relativePath: TRACK_RELATIVE_PATHS.fire };
  }

  if (
    source === 'floodzones' ||
    /\b(flood|flooding|flash flood|inundation)\b/.test(blob)
  ) {
    return { mood: 'flood', relativePath: TRACK_RELATIVE_PATHS.flood };
  }

  if (
    source === 'nhc' ||
    /\b(hurricane|tropical storm|cyclone|typhoon)\b/.test(blob)
  ) {
    return { mood: 'hurricane', relativePath: TRACK_RELATIVE_PATHS.hurricane };
  }

  if (
    source === 'usgs' ||
    /\b(earthquake|quake|seismic|tremor)\b/.test(blob)
  ) {
    return { mood: 'earthquake', relativePath: TRACK_RELATIVE_PATHS.earthquake };
  }

  if (
    source === 'nws' ||
    /\b(storm|thunderstorm|tornado|blizzard|winter storm|severe weather|wind)\b/.test(blob)
  ) {
    return { mood: 'storm', relativePath: TRACK_RELATIVE_PATHS.storm };
  }

  return { mood: 'default', relativePath: TRACK_RELATIVE_PATHS.default };
}
