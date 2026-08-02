/**
 * Development work by David Lane
 *
 * Dry-run endpoint behind the Condition Manager page. The caller supplies the legacy
 * `ConditionsTemplate.xml` CDO; the conversion is pure and nothing is written to
 * Encompass or to disk.
 */
import {
  readConditionsCdo,
  buildMigrationBundle,
  renderMigrationReport,
} from '../services/encompass-conditions-migration.service.js';

function normalizePersonas(input) {
  if (input == null || input === '') return [];
  if (Array.isArray(input)) return input;
  if (typeof input === 'object') return input.personas || input.items || input.value || [];
  return null;
}

export async function postConvertConditionsCdo(req, res) {
  const { cdo, personas, personaSource } = req.body || {};

  if (!cdo || (typeof cdo !== 'string' && typeof cdo !== 'object')) {
    return res.status(400).json({
      error: 'Request body must include `cdo` as the CDO response object, base64 payload, or Conditions XML',
    });
  }

  const personaList = normalizePersonas(personas);
  if (personaList === null) {
    return res.status(400).json({ error: '`personas` must be an array or a response object containing one' });
  }

  if (personaSource != null && typeof personaSource !== 'string') {
    return res.status(400).json({ error: '`personaSource` must be a label such as "UAT" or "Production"' });
  }

  // Decoding is separated from conversion so a malformed upload is reported as a bad
  // request rather than a server fault.
  let xml;
  let inputFormat;
  try {
    ({ xml, notes: inputFormat } = readConditionsCdo(cdo));
  } catch (error) {
    return res.status(400).json({ error: 'Could not read the supplied CDO', details: error.message });
  }

  try {
    const bundle = buildMigrationBundle(xml, { personas: personaList, personaSource });
    return res.json({ bundle, inputFormat, reportMarkdown: renderMigrationReport(bundle) });
  } catch (error) {
    console.error('Error converting Conditions CDO:', error.message);
    return res.status(500).json({
      error: 'Failed to convert the Conditions CDO',
      details: error.message,
    });
  }
}
