/**
 * Browser wrapper for cinematic Google Earth KML export (unified disasters page).
 */
import {
  generateCinematicDisasterKml,
  buildExportFilename,
  canExportCinematicKml,
  KML_MIME,
} from '../../lib/disaster-kml-export.js';

/**
 * Build KML from current unified-disaster page state.
 * @param {object} pageState
 */
export function buildKmlFromPageState(pageState) {
  const {
    selectedDisaster,
    lastAffectedLoans = [],
    lastNearbyCameras = [],
    lastLoanFilterMeta = null,
    baseUrl = typeof window !== 'undefined' ? window.location.origin : '',
  } = pageState || {};

  const meta = {
    ...(lastLoanFilterMeta || {}),
    radiusMiles: lastLoanFilterMeta?.radiusMiles ?? null,
    exportedAt: new Date().toISOString(),
  };

  return generateCinematicDisasterKml({
    disaster: selectedDisaster,
    loans: lastAffectedLoans,
    cameras: lastNearbyCameras,
    meta,
    baseUrl,
    includeAudio: true,
  });
}

export function downloadKmlBlob(filename, kmlContent) {
  const blob = new Blob([kmlContent], { type: `${KML_MIME};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * Manual export triggered from unified disasters UI.
 * @returns {{ success: boolean, message?: string, filename?: string }}
 */
export function exportCinematicKmlFromPageState(pageState) {
  const {
    selectedDisaster,
    lastAffectedLoans = [],
    lastNearbyCameras = [],
  } = pageState || {};

  if (!canExportCinematicKml({ disaster: selectedDisaster })) {
    return {
      success: false,
      message: 'Select a disaster in the grid before exporting Google Earth KML.',
    };
  }

  const kml = buildKmlFromPageState(pageState);
  const filename = buildExportFilename(selectedDisaster);
  downloadKmlBlob(filename, kml);

  return {
    success: true,
    filename,
    message: `Downloaded ${filename} — open in Google Earth and press Play on the tour.`,
  };
}

if (typeof window !== 'undefined') {
  window.DisasterKmlExport = {
    buildKmlFromPageState,
    downloadKmlBlob,
    exportCinematicKmlFromPageState,
    canExportCinematicKml,
    buildExportFilename,
  };
}
