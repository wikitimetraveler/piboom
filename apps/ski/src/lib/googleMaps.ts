/* eslint-disable @typescript-eslint/no-explicit-any */
/** Minimal surface of google.maps the ski app touches; the full typings package is not installed. */
export type GMaps = any;

let loading: Promise<GMaps> | null = null;

const CALLBACK = '__skiGoogleMapsReady';

/** Loads Maps JS once (beta channel so the photorealistic `maps3d` library is available). */
export function loadGoogleMaps(): Promise<GMaps> {
  if (!loading) {
    loading = (async () => {
      const w = window as any;
      if (w.google?.maps?.importLibrary) return w.google.maps;
      const res = await fetch('/api/ski/google-api-key');
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.apiKey) throw new Error('Google Maps is not configured on the server.');
      await new Promise<void>((resolve, reject) => {
        w[CALLBACK] = () => resolve();
        const s = document.createElement('script');
        const params = new URLSearchParams({ key: body.apiKey, v: 'beta', loading: 'async', callback: CALLBACK });
        s.src = `https://maps.googleapis.com/maps/api/js?${params}`;
        s.async = true;
        s.onerror = () => reject(new Error('Google Maps could not load. Check the connection and try again.'));
        document.head.append(s);
      });
      return w.google.maps;
    })().catch((err) => {
      loading = null;
      throw err;
    });
  }
  return loading;
}

export function boundsCenter(b: { south: number; north: number; west: number; east: number }) {
  return { lat: (b.south + b.north) / 2, lng: (b.west + b.east) / 2 };
}

/** Rough span of a lat/lng box in meters (diagonal), for 3D camera range. */
export function boundsSpanM(b: { south: number; north: number; west: number; east: number }): number {
  const latMid = ((b.south + b.north) / 2) * (Math.PI / 180);
  const dx = (b.east - b.west) * 111_320 * Math.cos(latMid);
  const dy = (b.north - b.south) * 111_320;
  return Math.hypot(dx, dy);
}

export function boundsOf(points: { lat: number; lng: number }[]) {
  if (!points.length) return null;
  let south = Infinity;
  let north = -Infinity;
  let west = Infinity;
  let east = -Infinity;
  for (const p of points) {
    if (p.lat < south) south = p.lat;
    if (p.lat > north) north = p.lat;
    if (p.lng < west) west = p.lng;
    if (p.lng > east) east = p.lng;
  }
  return { south, north, west, east };
}
