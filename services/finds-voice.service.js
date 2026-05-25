/**
 * Development work by David Lane
 */
/**
 * Plain-text summary for TTS (client calls POST /api/voice/synthesize).
 * @param {object} find - normalized find from rowToFind (id, title, category, status, score, scoreLabel, payload, …)
 */
export function buildFindSummaryText(find) {
  if (!find) return 'No find loaded.';

  const p = find.payload || {};
  const id = p.identification || {};
  const acq = p.acquisition || {};
  const val = p.valuation || {};

  const parts = [];
  parts.push(`This find is titled ${find.title || 'untitled'}.`);
  parts.push(`Category: ${find.category || 'unknown'}. Status: ${find.status || 'unknown'}.`);
  if (id.maker || id.probableMaker) {
    parts.push(`Maker or artist: ${id.maker || id.probableMaker}.`);
  }
  if (acq.pricePaid != null && acq.pricePaid !== '') {
    parts.push(`Price paid: ${acq.pricePaid} dollars.`);
  }
  if (acq.location) {
    parts.push(`Location: ${acq.location}.`);
  }
  if (val.realisticLow != null && val.realisticHigh != null) {
    parts.push(`Estimated realistic value range: ${val.realisticLow} to ${val.realisticHigh} dollars.`);
  }
  parts.push(`Treasure score: ${find.score} out of 100, ${find.scoreLabel || 'low'} tier.`);
  if (p.notes) {
    parts.push(`Notes: ${String(p.notes).slice(0, 500)}`);
  }
  if (p.aiAnalysis?.summaryText) {
    parts.push(String(p.aiAnalysis.summaryText).slice(0, 600));
  }

  return parts.join(' ');
}
