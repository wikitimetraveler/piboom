#!/usr/bin/env node
/**
 * Download NASA globe textures for the home WebGPU orbs:
 *   - Blue Marble day + city lights (Earth)
 *   - LRO color poles map (Moon)
 * Resize to 2048×1024 JPEGs.
 *
 *   npm run fetch:nasa-blue-marble
 *   npm run fetch:nasa-blue-marble -- --force
 *
 * Imagery: NASA Visible Earth / NASA SVS CGI Moon Kit (public domain).
 * Development work by David Lane
 */
import { mkdir, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const WIDTH = 2048;
const HEIGHT = 1024;
const FORCE = process.argv.includes('--force');

const ASSETS = [
  {
    key: 'blueMarble',
    dir: 'public/shared/textures/earth',
    file: 'blue-marble.jpg',
    url: 'https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57752/land_shallow_topo_2048.jpg',
    credit: 'NASA Visible Earth — Blue Marble: Land Surface, Shallow Water, and Shaded Topography',
  },
  {
    key: 'earthLights',
    dir: 'public/shared/textures/earth',
    file: 'earth-lights.jpg',
    url: 'https://eoimages.gsfc.nasa.gov/images/imagerecords/55000/55167/earth_lights_lrg.jpg',
    credit: "NASA Visible Earth — Earth's City Lights (DMSP)",
  },
  {
    key: 'moonColor',
    dir: 'public/shared/textures/moon',
    file: 'moon-color.jpg',
    url: 'https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_poles_2k.tif',
    credit: 'NASA SVS / LRO — CGI Moon Kit color map',
  },
  {
    key: 'mercury',
    dir: 'public/shared/textures/planets',
    file: 'mercury.jpg',
    url: 'https://maps.jpl.nasa.gov/tmaps/pix/mer0muu2.jpg',
    credit: 'NASA / JPL / USGS — Mercury (Mariner 10 texture map)',
  },
  {
    key: 'venus',
    dir: 'public/shared/textures/planets',
    file: 'venus.jpg',
    url: 'https://maps.jpl.nasa.gov/tmaps/pix/ven0aaa2.jpg',
    credit: 'NASA / JPL / USGS — Venus (Magellan texture map)',
  },
  {
    key: 'mars',
    dir: 'public/shared/textures/planets',
    file: 'mars.jpg',
    url: 'https://maps.jpl.nasa.gov/tmaps/pix/mar0kuu2.jpg',
    credit: 'NASA / JPL / USGS — Mars (Viking color texture map)',
  },
  {
    key: 'jupiter',
    dir: 'public/shared/textures/planets',
    file: 'jupiter.jpg',
    url: 'https://maps.jpl.nasa.gov/tmaps/pix/jup1vss2.jpg',
    credit: 'NASA / JPL — Jupiter (Voyager texture map)',
  },
  {
    key: 'saturn',
    dir: 'public/shared/textures/planets',
    file: 'saturn.jpg',
    url: 'https://maps.jpl.nasa.gov/tmaps/pix/sat1vss2.jpg',
    credit: 'NASA / JPL — Saturn (Voyager texture map)',
  },
  {
    key: 'uranus',
    dir: 'public/shared/textures/planets',
    file: 'uranus.jpg',
    url: 'https://maps.jpl.nasa.gov/tmaps/pix/ura1vuu2.jpg',
    credit: 'NASA / JPL — Uranus (Voyager texture map)',
  },
  {
    key: 'neptune',
    dir: 'public/shared/textures/planets',
    file: 'neptune.jpg',
    url: 'https://maps.jpl.nasa.gov/tmaps/pix/nep1vuu2.jpg',
    credit: 'NASA / JPL — Neptune (Voyager texture map)',
  },
  {
    key: 'pluto',
    dir: 'public/shared/textures/planets',
    file: 'pluto.jpg',
    url: 'https://maps.jpl.nasa.gov/tmaps/pix/plu0rss1.jpg',
    credit: 'NASA / JPL — Pluto texture map',
  },
];

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function download(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'DevConnectLabs-WebGpuGlobe/1.0 (local texture fetch; NASA public domain)',
      Accept: 'image/*,*/*',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  const manifestByDir = {};

  for (const asset of ASSETS) {
    const outDir = path.join(ROOT, asset.dir);
    await mkdir(outDir, { recursive: true });
    if (!manifestByDir[asset.dir]) {
      manifestByDir[asset.dir] = {
        fetchedAt: new Date().toISOString(),
        width: WIDTH,
        height: HEIGHT,
        credit: asset.dir.includes('moon')
          ? 'Imagery: NASA SVS / LRO Moon'
          : asset.dir.includes('planets')
            ? 'Imagery: NASA / JPL Solar System Simulator texture maps'
            : 'Imagery: NASA Visible Earth / Blue Marble',
        assets: {},
      };
    }
    const dest = path.join(outDir, asset.file);
    if (!FORCE && (await exists(dest))) {
      console.log(`skip (exists): ${asset.file}`);
      manifestByDir[asset.dir].assets[asset.key] = {
        file: asset.file,
        path: `/${asset.dir.replace(/^public\//, '')}/${asset.file}`.replace(/\\/g, '/'),
        sourceUrl: asset.url,
        credit: asset.credit,
        skipped: true,
      };
      continue;
    }
    console.log(`fetch ${asset.key}…`);
    const raw = await download(asset.url);
    await sharp(raw)
      .resize(WIDTH, HEIGHT, { fit: 'fill' })
      .jpeg({ quality: 82, mozjpeg: true })
      .toFile(dest);
    console.log(`wrote ${asset.file} (${WIDTH}×${HEIGHT})`);
    manifestByDir[asset.dir].assets[asset.key] = {
      file: asset.file,
      path: `/${asset.dir.replace(/^public\//, '')}/${asset.file}`.replace(/\\/g, '/'),
      sourceUrl: asset.url,
      credit: asset.credit,
    };
  }

  for (const [dir, manifest] of Object.entries(manifestByDir)) {
    const manifestPath = path.join(ROOT, dir, 'manifest.json');
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
    console.log('wrote', path.relative(ROOT, manifestPath));
  }
  console.log('Done.');
}

main().catch((err) => {
  console.error('fetch:nasa-blue-marble failed:', err.message || err);
  process.exit(1);
});
