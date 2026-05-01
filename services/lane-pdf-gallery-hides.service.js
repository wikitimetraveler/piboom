import { getPool } from './database.service.js';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PLATE_IMAGE_ID_RE = /^p\d+-i\d+$/;

export function isValidClientId(clientId) {
  return typeof clientId === 'string' && UUID_RE.test(clientId.trim());
}

export function isValidPlateImageId(raw) {
  return typeof raw === 'string' && PLATE_IMAGE_ID_RE.test(raw.trim());
}

function normalizePlateId(raw) {
  return typeof raw === 'string' ? raw.trim() : '';
}

/** @returns {{ ok: boolean, error?: string }} */
export function validateClientPlateIds(clientId, imageId) {
  const cid = typeof clientId === 'string' ? clientId.trim() : '';
  if (!isValidClientId(cid)) return { ok: false, error: 'Invalid clientId (expected UUID)' };
  const iid = normalizePlateId(imageId);
  if (!isValidPlateImageId(iid)) return { ok: false, error: 'Invalid plate imageId' };
  return { ok: true };
}

/**
 * Hidden plate IDs for this browser client (Postgres UUID bucket).
 */
export async function getHiddenPlateState(clientId) {
  if (!isValidClientId(clientId)) {
    throw new Error('Invalid clientId');
  }
  const pool = getPool();
  const [hiddenRes, stackRes] = await Promise.all([
    pool.query(`SELECT image_id FROM lane_pdf_gallery_hidden_plate WHERE client_id = $1::uuid ORDER BY hidden_at`, [
      clientId
    ]),
    pool.query(
      `SELECT COUNT(*)::int AS c FROM lane_pdf_gallery_hide_stack WHERE client_id = $1::uuid`,
      [clientId]
    )
  ]);
  return {
    hiddenImageIds: hiddenRes.rows.map((r) => String(r.image_id)),
    canUndo: Number(stackRes.rows[0]?.c || 0) > 0
  };
}

/**
 * Hide one plate + push undo stack row (each Hide click pushes, even repeats).
 */
export async function hidePlate(clientId, imageId) {
  const v = validateClientPlateIds(clientId, imageId);
  if (!v.ok) throw new Error(v.error);
  const iid = normalizePlateId(imageId);
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO lane_pdf_gallery_hidden_plate (client_id, image_id) VALUES ($1::uuid, $2)
       ON CONFLICT (client_id, image_id) DO NOTHING`,
      [clientId, iid]
    );
    await client.query(
      `INSERT INTO lane_pdf_gallery_hide_stack (client_id, image_id) VALUES ($1::uuid, $2)`,
      [clientId, iid]
    );
    await client.query('COMMIT');
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {
      /* ignore */
    }
    throw e;
  } finally {
    client.release();
  }
  return getHiddenPlateState(clientId);
}

/**
 * Pop last stack entry and remove that image from hidden set when present.
 */
export async function undoLastHide(clientId) {
  if (!isValidClientId(clientId)) throw new Error('Invalid clientId');
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const pop = await client.query(
      `DELETE FROM lane_pdf_gallery_hide_stack
       WHERE id = (
         SELECT id FROM lane_pdf_gallery_hide_stack WHERE client_id = $1::uuid ORDER BY created_at DESC LIMIT 1
       )
       RETURNING image_id`,
      [clientId]
    );
    let undoneImageId = null;
    if (pop.rows.length > 0) {
      undoneImageId = String(pop.rows[0].image_id);
      await client.query(
        `DELETE FROM lane_pdf_gallery_hidden_plate WHERE client_id = $1::uuid AND image_id = $2`,
        [clientId, undoneImageId]
      );
    }
    await client.query('COMMIT');
    const state = await getHiddenPlateState(clientId);
    return { undoneImageId, ...state };
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {
      /* ignore */
    }
    throw e;
  } finally {
    client.release();
  }
}

/** Remove all hides + undo stack for this client */
export async function clearClientHides(clientId) {
  if (!isValidClientId(clientId)) throw new Error('Invalid clientId');
  const pool = getPool();
  await pool.query(`DELETE FROM lane_pdf_gallery_hide_stack WHERE client_id = $1::uuid`, [clientId]);
  await pool.query(`DELETE FROM lane_pdf_gallery_hidden_plate WHERE client_id = $1::uuid`, [clientId]);
  return getHiddenPlateState(clientId);
}

/**
 * One-shot migration from browser localStorage list (deduped); invalid ids skipped.
 */
export async function bulkImportHiddenPlates(clientId, imageIds) {
  if (!isValidClientId(clientId)) throw new Error('Invalid clientId');
  if (!Array.isArray(imageIds)) throw new Error('imageIds must be an array');
  const pool = getPool();
  const unique = [...new Set(imageIds.map((x) => normalizePlateId(x)).filter((id) => isValidPlateImageId(id)))];
  if (unique.length === 0) return getHiddenPlateState(clientId);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const iid of unique) {
      await client.query(
        `INSERT INTO lane_pdf_gallery_hidden_plate (client_id, image_id) VALUES ($1::uuid, $2)
         ON CONFLICT (client_id, image_id) DO NOTHING`,
        [clientId, iid]
      );
    }
    await client.query('COMMIT');
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {
      /* ignore */
    }
    throw e;
  } finally {
    client.release();
  }
  return getHiddenPlateState(clientId);
}
