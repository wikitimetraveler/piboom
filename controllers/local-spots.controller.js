import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { getGoogleBrowserApiKey } from '../lib/google-api-key.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_FILE = path.join(__dirname, '..', 'data', 'local-spots.json');

const VALID_CATEGORIES = ['thrift', 'taco_truck', 'garden', 'bike_trail', 'fishing', 'kayak', 'concert'];

async function readData() {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return { spots: [] };
    }
    throw err;
  }
}

async function writeData(data) {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

export async function listSpots(req, res) {
  try {
    const { category, favorite } = req.query;
    const data = await readData();
    let spots = data.spots || [];

    if (category && VALID_CATEGORIES.includes(category)) {
      spots = spots.filter((s) => s.category === category);
    }

    if (favorite === 'true' || favorite === '1') {
      spots = spots.filter((s) => s.favorite === true);
    }

    res.json({ success: true, spots });
  } catch (error) {
    console.error('Local spots list error:', error);
    res.status(500).json({ success: false, error: 'Failed to list spots', message: error.message });
  }
}

export async function addSpot(req, res) {
  try {
    const { name, category, lat, lng, address, notes, tags, imageUrl } = req.body;

    if (!name || !category) {
      return res.status(400).json({ success: false, error: 'Name and category are required' });
    }

    if (!VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ success: false, error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}` });
    }

    if (lat == null || lng == null) {
      return res.status(400).json({ success: false, error: 'Latitude and longitude are required' });
    }

    const data = await readData();
    const spots = data.spots || [];

    const spot = {
      id: randomUUID(),
      name: String(name).trim(),
      category,
      lat: Number(lat),
      lng: Number(lng),
      address: address ? String(address).trim() : null,
      notes: notes ? String(notes).trim() : null,
      tags: Array.isArray(tags) ? tags : tags ? [String(tags).trim()] : [],
      imageUrl: imageUrl ? String(imageUrl).trim() : null,
      favorite: Boolean(req.body.favorite),
      createdAt: new Date().toISOString()
    };

    spots.push(spot);
    await writeData({ spots });

    res.json({ success: true, spot });
  } catch (error) {
    console.error('Local spots add error:', error);
    res.status(500).json({ success: false, error: 'Failed to add spot', message: error.message });
  }
}

export async function updateSpot(req, res) {
  try {
    const { id } = req.params;
    const { name, category, lat, lng, address, notes, tags, imageUrl, favorite } = req.body;

    if (!id) {
      return res.status(400).json({ success: false, error: 'Spot id is required' });
    }

    const data = await readData();
    const spots = data.spots || [];
    const idx = spots.findIndex((s) => s.id === id);

    if (idx === -1) {
      return res.status(404).json({ success: false, error: 'Spot not found' });
    }

    const existing = spots[idx];

    if (name !== undefined) existing.name = String(name).trim();
    if (category !== undefined) {
      if (!VALID_CATEGORIES.includes(category)) {
        return res.status(400).json({ success: false, error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}` });
      }
      existing.category = category;
    }
    if (lat !== undefined) existing.lat = Number(lat);
    if (lng !== undefined) existing.lng = Number(lng);
    if (address !== undefined) existing.address = address ? String(address).trim() : null;
    if (notes !== undefined) existing.notes = notes ? String(notes).trim() : null;
    if (tags !== undefined) existing.tags = Array.isArray(tags) ? tags : tags ? [String(tags).trim()] : [];
    if (imageUrl !== undefined) existing.imageUrl = imageUrl ? String(imageUrl).trim() : null;
    if (favorite !== undefined) existing.favorite = Boolean(favorite);

    await writeData({ spots });

    res.json({ success: true, spot: existing });
  } catch (error) {
    console.error('Local spots update error:', error);
    res.status(500).json({ success: false, error: 'Failed to update spot', message: error.message });
  }
}

export async function deleteSpot(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ success: false, error: 'Spot id is required' });
    }

    const data = await readData();
    const spots = (data.spots || []).filter((s) => s.id !== id);

    if (spots.length === data.spots?.length) {
      return res.status(404).json({ success: false, error: 'Spot not found' });
    }

    await writeData({ spots });

    res.json({ success: true, deleted: id });
  } catch (error) {
    console.error('Local spots delete error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete spot', message: error.message });
  }
}

export async function importSpots(req, res) {
  try {
    const { spots: incomingSpots } = req.body;

    if (!Array.isArray(incomingSpots) || incomingSpots.length === 0) {
      return res.status(400).json({ success: false, error: 'spots array is required and must not be empty' });
    }

    const data = await readData();
    const spots = data.spots || [];
    let imported = 0;

    for (const s of incomingSpots) {
      const name = s.name || s.title || '';
      const category = s.category || 'thrift';
      const lat = s.lat ?? s.latitude;
      const lng = s.lng ?? s.longitude;

      if (!name || lat == null || lng == null || !VALID_CATEGORIES.includes(category)) continue;

      spots.push({
        id: randomUUID(),
        name: String(name).trim(),
        category,
        lat: Number(lat),
        lng: Number(lng),
        address: s.address ? String(s.address).trim() : null,
        notes: s.notes ? String(s.notes).trim() : null,
        tags: Array.isArray(s.tags) ? s.tags : s.tags ? [String(s.tags).trim()] : [],
        imageUrl: s.imageUrl ? String(s.imageUrl).trim() : null,
        favorite: Boolean(s.favorite),
        createdAt: new Date().toISOString()
      });
      imported++;
    }

    await writeData({ spots });

    res.json({ success: true, imported, total: spots.length });
  } catch (error) {
    console.error('Local spots import error:', error);
    res.status(500).json({ success: false, error: 'Failed to import spots', message: error.message });
  }
}

export function getGoogleMapsKey(req, res) {
  try {
    const apiKey = getGoogleBrowserApiKey();
    res.json({ apiKey: apiKey || null });
  } catch (error) {
    console.error('Local spots Google API key error:', error);
    res.status(500).json({ error: 'Failed to get Google API key' });
  }
}
