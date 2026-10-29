/**
 * SKLD point clouds baked by scripts/tools/build-ski-lidar.mjs.
 * Header is 40 bytes, then 8-byte points: uint16 x, y, z, uint8 class, uint8 hag meters.
 */
import { useEffect, useState } from 'react';

export const LIDAR_HEADER_BYTES = 40;
export const LIDAR_POINT_STRIDE = 8;

export interface LidarSource {
  name: string;
  year?: number | null;
  url?: string;
}

export interface LidarManifest {
  id: string;
  name?: string;
  south: number;
  north: number;
  west: number;
  east: number;
  zMinFt: number;
  zMaxFt: number;
  sources?: LidarSource[];
  note?: string;
  attribution?: string;
}

export interface LidarCloud {
  count: number;
  south: number;
  north: number;
  west: number;
  east: number;
  zMinFt: number;
  zMaxFt: number;
  x: Uint16Array;
  y: Uint16Array;
  z: Uint16Array;
  cls: Uint8Array;
  hag: Uint8Array;
  attribution: string;
  lod: number;
}

export function formatLidarAttribution(manifest: LidarManifest | null): string {
  const sources = manifest?.sources || [];
  const first = sources[0];
  if (!first?.name) return 'USGS 3DEP lidar';
  const year = first.year ? ` (${first.year})` : '';
  const extra = sources.length > 1 ? ` +${sources.length - 1} more` : '';
  return `USGS 3DEP lidar, work unit ${first.name}${year}${extra}`;
}

export function decodeLidarBin(buffer: ArrayBuffer, lod = 0): LidarCloud | null {
  if (buffer.byteLength < LIDAR_HEADER_BYTES) return null;
  const view = new DataView(buffer);
  const magic = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  if (magic !== 'SKLD') return null;
  const count = view.getUint32(8, true);
  const need = LIDAR_HEADER_BYTES + count * LIDAR_POINT_STRIDE;
  if (buffer.byteLength < need) return null;
  const x = new Uint16Array(count);
  const y = new Uint16Array(count);
  const z = new Uint16Array(count);
  const cls = new Uint8Array(count);
  const hag = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    const o = LIDAR_HEADER_BYTES + i * LIDAR_POINT_STRIDE;
    x[i] = view.getUint16(o, true);
    y[i] = view.getUint16(o + 2, true);
    z[i] = view.getUint16(o + 4, true);
    cls[i] = view.getUint8(o + 6);
    hag[i] = view.getUint8(o + 7);
  }
  return {
    count,
    south: view.getFloat32(12, true),
    north: view.getFloat32(16, true),
    west: view.getFloat32(20, true),
    east: view.getFloat32(24, true),
    zMinFt: view.getFloat32(28, true),
    zMaxFt: view.getFloat32(32, true),
    x,
    y,
    z,
    cls,
    hag,
    attribution: '',
    lod,
  };
}

async function fetchManifest(demId: string): Promise<LidarManifest | null> {
  const api = await fetch(`/api/ski/lidar/${demId}`);
  if (api.ok && (api.headers.get('content-type') || '').includes('json')) {
    return (await api.json()) as LidarManifest;
  }
  const file = await fetch(`/data/ski/lidar/${demId}.json`);
  if (!file.ok) return null;
  return (await file.json()) as LidarManifest;
}

async function fetchBin(demId: string, lod: 0 | 1): Promise<ArrayBuffer | null> {
  const api = await fetch(`/api/ski/lidar/${demId}/${lod}`);
  const type = api.headers.get('content-type') || '';
  if (api.ok && !type.includes('json') && !type.includes('html')) return api.arrayBuffer();
  if (lod !== 0) return null;
  const file = await fetch(`/data/ski/lidar/${demId}-lod0.bin`);
  if (!file.ok) return null;
  return file.arrayBuffer();
}

export function useLidarCloud(demId: string | undefined, enabled: boolean) {
  const [cloud, setCloud] = useState<LidarCloud | null>(null);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!enabled || !demId) {
      setCloud(null);
      setNote('');
      return;
    }
    let live = true;
    setCloud(null);
    setNote('Loading USGS lidar…');
    (async () => {
      try {
        const manifest = await fetchManifest(demId);
        if (!live) return;
        if (!manifest) {
          setNote('Lidar not baked for this mountain — run npm run build:ski-lidar.');
          return;
        }
        const lod0 = await fetchBin(demId, 0);
        if (!live) return;
        const decoded = lod0 ? decodeLidarBin(lod0, 0) : null;
        if (!decoded) {
          setNote('Lidar manifest is here, but the point file could not be read.');
          return;
        }
        decoded.attribution = formatLidarAttribution(manifest);
        setCloud(decoded);
        setNote('');
        const lod1 = await fetchBin(demId, 1);
        if (!lod1 || !live) return;
        const dense = decodeLidarBin(lod1, 1);
        if (!dense || !live) return;
        dense.attribution = decoded.attribution;
        setCloud(dense);
      } catch {
        if (live) setNote('Lidar could not be loaded.');
      }
    })();
    return () => {
      live = false;
    };
  }, [demId, enabled]);

  return { cloud: enabled ? cloud : null, note: enabled ? note : '' };
}
