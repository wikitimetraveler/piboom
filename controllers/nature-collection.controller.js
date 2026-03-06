import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { getPool } from '../services/database.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SHARE_STORE_PATH = path.join(__dirname, '..', 'data', 'nature-collection-shares.json');

async function loadShareStore() {
  try {
    const raw = await fs.readFile(SHARE_STORE_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function saveShareStore(store) {
  await fs.mkdir(path.dirname(SHARE_STORE_PATH), { recursive: true });
  await fs.writeFile(SHARE_STORE_PATH, JSON.stringify(store, null, 2));
}

export async function createCollectionShare(req, res) {
  try {
    const { userId, trees, critters } = req.body;
    const pool = getPool();

    let snapshot = { trees: [], critters: [] };

    if (trees && critters) {
      snapshot = { trees, critters };
    } else if (pool) {
      const isAll = userId === 'all';
      const treeParams = !isAll && userId ? [userId] : [];
      const treeQuery = isAll
        ? 'SELECT * FROM trees ORDER BY added_date DESC'
        : userId
          ? 'SELECT * FROM trees WHERE user_id = $1 ORDER BY added_date DESC'
          : 'SELECT * FROM trees WHERE user_id IS NULL ORDER BY added_date DESC';
      const critterParams = !isAll && userId ? [userId] : [];
      const critterQuery = isAll
        ? 'SELECT * FROM critters ORDER BY added_date DESC'
        : userId
          ? 'SELECT * FROM critters WHERE user_id = $1 ORDER BY added_date DESC'
          : 'SELECT * FROM critters WHERE user_id IS NULL ORDER BY added_date DESC';

      const [treeResult, critterResult] = await Promise.all([
        pool.query(treeQuery, treeParams),
        pool.query(critterQuery, critterParams),
      ]);
      snapshot = { trees: treeResult.rows, critters: critterResult.rows };
    } else {
      return res.status(400).json({ success: false, error: 'Provide userId or trees+critters' });
    }

    const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    const store = await loadShareStore();
    store[id] = {
      id,
      trees: snapshot.trees,
      critters: snapshot.critters,
      createdAt: new Date().toISOString(),
    };
    await saveShareStore(store);

    return res.json({
      success: true,
      shareId: id,
      shareUrl: `/share/collection/${id}`,
      count: { trees: snapshot.trees.length, critters: snapshot.critters.length },
    });
  } catch (error) {
    console.error('❌ Error creating collection share:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function getCollectionShare(req, res) {
  try {
    const { id } = req.params;
    const store = await loadShareStore();
    if (!store[id]) {
      return res.status(404).json({ success: false, error: 'Share not found' });
    }
    return res.json({ success: true, share: store[id] });
  } catch (error) {
    console.error('❌ Error loading collection share:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
